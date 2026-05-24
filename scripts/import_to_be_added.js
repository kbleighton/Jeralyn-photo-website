const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "assets", "photos", "TO BE ADDED");
const photosRoot = path.join(projectRoot, "assets", "photos");
const dataFile = path.join(projectRoot, "data", "galleries.js");
const previewRoot = path.join("/private/tmp", "gallery-import-previews");
const requestedAlbumKeys = new Set(process.argv.slice(2).map(normalizeAlbumKey));

const stillExtensions = new Set([".heic", ".jpg", ".jpeg", ".png", ".dng"]);
const rawExtensions = new Set([".heic", ".dng"]);
const imageCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const monthMap = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};
const albumOverrides = {
  "xinalani-retreat": {
    slug: "xinalani",
    title: "Xinalani",
    dateLabel: "May 2025",
    year: 2025,
    tags: ["Travel", "Outdoors"],
    location: "Xinalani Retreat",
    description: "A travel gallery from Xinalani."
  },
  "holidays-nye-2025": {
    slug: "holidays-nye",
    title: "Holidays & NYE",
    dateLabel: "November 2024 - January 2025",
    year: 2025,
    tags: ["Celebration", "Family"],
    location: "Holiday season",
    description: "Holiday memories and New Year celebrations."
  },
  "ube-fest": {
    slug: "ube-fest",
    title: "Ube Fest",
    tags: ["Celebration", "Friends"],
    location: "Ube Fest",
    description: "A festival gallery from Ube Fest."
  },
  "doggie-love-2": {
    slug: "doggie-love",
    title: "Doggie Love"
  }
};

main();

function main() {
  const existingGalleries = loadExistingGalleries();
  const existingBySlug = new Map(existingGalleries.map(function (gallery) {
    return [gallery.slug, gallery];
  }));

  let albumFolders = fs
    .readdirSync(sourceRoot, { withFileTypes: true })
    .filter(function (entry) {
      return entry.isDirectory();
    })
    .map(function (entry) {
      return entry.name;
    })
    .sort(imageCollator.compare);

  if (requestedAlbumKeys.size) {
    albumFolders = albumFolders.filter(function (folderName) {
      return matchesRequestedAlbum(folderName);
    });

    const foundKeys = new Set();
    albumFolders.forEach(function (folderName) {
      foundKeys.add(normalizeAlbumKey(folderName));
      foundKeys.add(slugify(folderName));
    });

    const missing = Array.from(requestedAlbumKeys).filter(function (key) {
      return !foundKeys.has(key);
    });

    if (missing.length) {
      throw new Error("Album folders not found: " + missing.join(", "));
    }
  }

  const importedGalleries = albumFolders.map(function (folderName) {
    return importAlbum(folderName);
  });

  importedGalleries.forEach(function (gallery) {
    existingBySlug.set(gallery.slug, gallery);
  });

  const merged = [];
  existingGalleries.forEach(function (gallery) {
    if (existingBySlug.has(gallery.slug)) {
      merged.push(existingBySlug.get(gallery.slug));
      existingBySlug.delete(gallery.slug);
    } else {
      merged.push(gallery);
    }
  });

  Array.from(existingBySlug.values())
    .sort(function (a, b) {
      return imageCollator.compare(a.title, b.title);
    })
    .forEach(function (gallery) {
      merged.push(gallery);
    });

  writeGalleryData(sortGalleriesByDate(merged));
  printSummary(importedGalleries);
}

function importAlbum(folderName) {
  const albumPath = path.join(sourceRoot, folderName);
  const override = albumOverrides[slugify(folderName)] || {};
  const slug = override.slug || slugify(folderName);
  const title = override.title || prettifyTitle(folderName);
  const destinationFolder = path.join(photosRoot, slug);
  const previewFolder = path.join(previewRoot, slug);

  fs.mkdirSync(destinationFolder, { recursive: true });
  fs.mkdirSync(previewFolder, { recursive: true });
  clearGeneratedFiles(destinationFolder);

  const stillFiles = fs
    .readdirSync(albumPath, { withFileTypes: true })
    .filter(function (entry) {
      return entry.isFile() && stillExtensions.has(path.extname(entry.name).toLowerCase());
    })
    .map(function (entry) {
      return entry.name;
    })
    .sort(imageCollator.compare);

  const fileRecords = stillFiles.map(function (fileName) {
    const filePath = path.join(albumPath, fileName);
    const extension = path.extname(fileName).toLowerCase();
    const createdAt = getImageDate(filePath);

    return {
      albumPath: albumPath,
      fileName: fileName,
      filePath: filePath,
      extension: extension,
      createdAt: createdAt,
      sortableDate: createdAt ? createdAt.getTime() : Number.MAX_SAFE_INTEGER
    };
  });

  fileRecords.sort(function (a, b) {
    if (a.sortableDate !== b.sortableDate) {
      return a.sortableDate - b.sortableDate;
    }
    return imageCollator.compare(a.fileName, b.fileName);
  });

  const rawFiles = fileRecords.filter(function (record) {
    return rawExtensions.has(record.extension);
  });

  if (rawFiles.length) {
    const qlArgs = ["-t", "-s", "2200", "-o", previewFolder].concat(
      rawFiles.map(function (record) {
        return record.filePath;
      })
    );
    execFileSync("qlmanage", qlArgs, { stdio: "pipe" });
  }

  const width = Math.max(2, String(fileRecords.length).length);
  const photos = fileRecords.map(function (record, index) {
    const destinationName = zeroPad(index + 1, width) + "-" + slug + ".jpg";
    const destinationPath = path.join(destinationFolder, destinationName);
    const caption = deriveCaption(title, record.fileName, index);
    const alt = caption === "Photo " + (index + 1)
      ? title + " photo " + (index + 1)
      : caption + " from " + title;

    if (rawExtensions.has(record.extension)) {
      const previewPath = path.join(previewFolder, record.fileName + ".png");
      convertToJpg(previewPath, destinationPath);
    } else {
      convertToJpg(record.filePath, destinationPath);
    }

    return {
      fileName: destinationName,
      alt: alt,
      caption: caption
    };
  });

  const imageDates = fileRecords
    .map(function (record) {
      return record.createdAt;
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return a.getTime() - b.getTime();
    });

  const tags = override.tags || deriveTags(title);
  const dateLabel = override.dateLabel || formatDateLabel(imageDates);
  const location = override.location || deriveLocation(title, tags);
  const description = override.description || deriveDescription(title, tags);
  const year = Object.prototype.hasOwnProperty.call(override, "year")
    ? override.year
    : imageDates.length
      ? imageDates[imageDates.length - 1].getFullYear()
      : new Date().getFullYear();

  return {
    slug: slug,
    title: title,
    dateLabel: dateLabel,
    year: year,
    location: location,
    tags: tags,
    description: description,
    featured: false,
    coverImage: photos[0] ? photos[0].fileName : "",
    photos: photos
  };
}

function loadExistingGalleries() {
  const source = fs.readFileSync(dataFile, "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return Array.isArray(context.window.GALLERY_DATA) ? context.window.GALLERY_DATA : [];
}

function writeGalleryData(galleries) {
  const output = [
    "/*",
    "  Non-technical update option:",
    "  open editor.html instead of editing this file by hand.",
    "*/",
    "",
    "window.GALLERY_DATA = " + JSON.stringify(galleries, null, 2) + ";",
    ""
  ].join("\n");

  fs.writeFileSync(dataFile, output);
}

function clearGeneratedFiles(folderPath) {
  fs.readdirSync(folderPath, { withFileTypes: true }).forEach(function (entry) {
    if (!entry.isFile()) {
      return;
    }

    const filePath = path.join(folderPath, entry.name);
    if (path.extname(entry.name).toLowerCase() === ".jpg") {
      fs.unlinkSync(filePath);
    }
  });
}

function sortGalleriesByDate(galleries) {
  return galleries.slice().sort(function (a, b) {
    const dateDifference = gallerySortTimestamp(b) - gallerySortTimestamp(a);
    if (dateDifference !== 0) {
      return dateDifference;
    }

    return imageCollator.compare(a.title, b.title);
  });
}

function gallerySortTimestamp(gallery) {
  const label = String(gallery.dateLabel || "").trim();
  let match;

  if ((match = label.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/))) {
    return new Date(
      Number(match[3]),
      monthMap[match[1].toLowerCase()],
      Number(match[2]),
      23,
      59,
      59,
      999
    ).getTime();
  }

  if ((match = label.match(/^([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})$/))) {
    return new Date(
      Number(match[4]),
      monthMap[match[1].toLowerCase()],
      Number(match[3]),
      23,
      59,
      59,
      999
    ).getTime();
  }

  if ((match = label.match(/^([A-Za-z]+)-([A-Za-z]+)\s+(\d{4})$/))) {
    return endOfMonth(Number(match[3]), monthMap[match[2].toLowerCase()]);
  }

  if ((match = label.match(/^([A-Za-z]+)\s+(\d{4})\s*-\s*([A-Za-z]+)\s+(\d{4})$/))) {
    return endOfMonth(Number(match[4]), monthMap[match[3].toLowerCase()]);
  }

  if ((match = label.match(/^([A-Za-z]+)\s+(\d{4})$/))) {
    return endOfMonth(Number(match[2]), monthMap[match[1].toLowerCase()]);
  }

  return new Date(Number(gallery.year) || 0, 11, 31, 23, 59, 59, 999).getTime();
}

function endOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999).getTime();
}

function convertToJpg(sourcePath, destinationPath) {
  execFileSync(
    "sips",
    ["-s", "format", "jpeg", "-s", "formatOptions", "85", sourcePath, "--out", destinationPath],
    { stdio: "pipe" }
  );
}

function getImageDate(filePath) {
  try {
    const output = execFileSync("sips", ["-g", "creation", filePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    const match = output.match(/creation:\s+(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/);
    if (match) {
      const normalized = match[1].replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T");
      return new Date(normalized);
    }
  } catch (error) {
    // Fall through to file system dates.
  }

  const stats = fs.statSync(filePath);
  return stats.mtime;
}

function deriveCaption(title, originalFileName, index) {
  const stem = path.basename(originalFileName, path.extname(originalFileName));
  if (/^(img[_ -]?\d+|lp_image)$/i.test(stem) || /^[0-9a-f-]{20,}$/i.test(stem)) {
    return "Photo " + (index + 1);
  }

  const cleaned = stem
    .replace(/[_-]+/g, " ")
    .replace(/\s+\d+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) {
    return "Photo " + (index + 1);
  }

  return cleaned;
}

function deriveTags(title) {
  const lower = title.toLowerCase();
  const tags = [];

  if (/(spain|barcelona|cairo|nairobi|kenya|safari|yosemite|venice|san sebasti|santa|lake arrowhead)/.test(lower)) {
    tags.push("Travel");
  }
  if (/(beach|yosemite|camp|hike|safari)/.test(lower)) {
    tags.push("Outdoors");
  }
  if (/(family)/.test(lower)) {
    tags.push("Family");
  }
  if (/(friends|bestie|fam)/.test(lower)) {
    tags.push("Friends");
  }
  if (/(birthday)/.test(lower)) {
    tags.push("Birthday");
  }
  if (/(date|kyle)/.test(lower)) {
    tags.push("Date Night");
  }
  if (/(dog|doggie)/.test(lower)) {
    tags.push("Pets");
  }
  if (/(party|spirit animal|santa)/.test(lower)) {
    tags.push("Celebration");
  }

  if (!tags.length) {
    tags.push("Memories");
  }

  return Array.from(new Set(tags));
}

function deriveLocation(title, tags) {
  const cleanTitle = title.replace(/[!]/g, "").trim();
  if (tags.includes("Travel")) {
    return cleanTitle;
  }
  if (tags.includes("Date Night")) {
    return "Favorite days together";
  }
  if (tags.includes("Family")) {
    return "Family time";
  }
  if (tags.includes("Friends")) {
    return "Time with friends";
  }
  return cleanTitle;
}

function deriveDescription(title, tags) {
  if (tags.includes("Travel")) {
    return "A travel gallery from " + title.replace(/[!]/g, "").trim() + ".";
  }
  if (tags.includes("Date Night")) {
    return "A date-adventure gallery from " + title.replace(/[!]/g, "").trim() + ".";
  }
  if (tags.includes("Birthday")) {
    return "A birthday gallery from " + title.replace(/[!]/g, "").trim() + ".";
  }
  if (tags.includes("Pets")) {
    return "A pet-filled gallery from " + title.replace(/[!]/g, "").trim() + ".";
  }
  return "A photo gallery from " + title.replace(/[!]/g, "").trim() + ".";
}

function formatDateLabel(dates) {
  if (!dates.length) {
    return String(new Date().getFullYear());
  }

  const start = dates[0];
  const end = dates[dates.length - 1];
  if (isSameDay(start, end)) {
    return formatLongDate(start);
  }
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return formatMonthYear(start);
  }
  if (start.getFullYear() === end.getFullYear()) {
    return monthName(start) + "-" + monthName(end) + " " + end.getFullYear();
  }
  return formatMonthYear(start) + " - " + formatMonthYear(end);
}

function formatLongDate(date) {
  return monthName(date) + " " + date.getDate() + ", " + date.getFullYear();
}

function formatMonthYear(date) {
  return monthName(date) + " " + date.getFullYear();
}

function monthName(date) {
  return date.toLocaleString("en-US", { month: "long" });
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prettifyTitle(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeAlbumKey(value) {
  return String(value).trim().toLowerCase();
}

function matchesRequestedAlbum(folderName) {
  const normalized = normalizeAlbumKey(folderName);
  const slug = slugify(folderName);

  return requestedAlbumKeys.has(normalized) || requestedAlbumKeys.has(slug);
}

function zeroPad(value, width) {
  return String(value).padStart(width, "0");
}

function printSummary(importedGalleries) {
  importedGalleries.forEach(function (gallery) {
    process.stdout.write(
      gallery.slug + " -> " + gallery.photos.length + " photos\n"
    );
  });
}
