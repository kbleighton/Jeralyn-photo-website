(function () {
  const STORAGE_KEY = "jeralyn-photo-site-editor-draft-v1";
  const publishedGalleries = toEditorState(
    Array.isArray(window.GALLERY_DATA) ? window.GALLERY_DATA : []
  );

  const elements = {
    galleryList: document.getElementById("gallery-list"),
    editorFormRoot: document.getElementById("editor-form-root"),
    statusMessage: document.getElementById("status-message"),
    exportPreview: document.getElementById("export-preview"),
    downloadDataButton: document.getElementById("download-data-button"),
    copyDataButton: document.getElementById("copy-data-button"),
    resetDraftButton: document.getElementById("reset-draft-button"),
    addGalleryButton: document.getElementById("add-gallery-button"),
    photoFilePicker: document.getElementById("photo-file-picker")
  };

  const draft = loadDraft();
  const state = {
    galleries: draft || clone(publishedGalleries),
    selectedGalleryId: null,
    notice: draft ? "Loaded a saved browser draft." : ""
  };

  state.selectedGalleryId = state.galleries[0] ? state.galleries[0].id : null;

  bindEvents();
  render();

  function bindEvents() {
    elements.addGalleryButton.addEventListener("click", function () {
      const gallery = createEmptyGallery();
      state.galleries.push(gallery);
      state.selectedGalleryId = gallery.id;
      persistDraft();
      render();
    });

    elements.galleryList.addEventListener("click", function (event) {
      const button = event.target.closest("[data-gallery-id]");
      if (!button) {
        return;
      }

      state.selectedGalleryId = button.getAttribute("data-gallery-id");
      renderGalleryList();
      renderEditorForm();
    });

    elements.editorFormRoot.addEventListener("input", function (event) {
      const gallery = getSelectedGallery();
      if (!gallery) {
        return;
      }

      if (event.target.matches("[data-field]")) {
        updateGalleryField(gallery, event.target);
        persistDraft();
        renderGalleryList();
        refreshStatus();
        refreshExportPreview();
        refreshFolderPath();
        return;
      }

      if (event.target.matches("[data-photo-field]")) {
        updatePhotoField(gallery, event.target);
        persistDraft();
        refreshStatus();
        refreshExportPreview();
      }
    });

    elements.editorFormRoot.addEventListener("click", function (event) {
      const gallery = getSelectedGallery();
      if (!gallery) {
        return;
      }

      const actionButton = event.target.closest("[data-action]");
      if (!actionButton) {
        return;
      }

      const action = actionButton.getAttribute("data-action");

      if (action === "add-photo") {
        gallery.photos.push(createEmptyPhoto());
        persistDraft();
        renderEditorForm();
        refreshStatus();
        refreshExportPreview();
        return;
      }

      if (action === "remove-photo") {
        const index = Number(actionButton.getAttribute("data-photo-index"));
        gallery.photos.splice(index, 1);
        persistDraft();
        renderEditorForm();
        refreshStatus();
        refreshExportPreview();
        return;
      }

      if (action === "import-photo-files") {
        elements.photoFilePicker.value = "";
        elements.photoFilePicker.click();
        return;
      }

      if (action === "remove-gallery") {
        if (!window.confirm("Remove this gallery from the editor?")) {
          return;
        }

        removeSelectedGallery();
        persistDraft();
        render();
      }
    });

    elements.photoFilePicker.addEventListener("change", function (event) {
      const gallery = getSelectedGallery();
      if (!gallery) {
        return;
      }

      const files = Array.from(event.target.files || []);
      if (!files.length) {
        return;
      }

      const existingPaths = new Set(
        gallery.photos.map(function (photo) {
          return photo.path.trim();
        })
      );

      files.forEach(function (file) {
        if (existingPaths.has(file.name)) {
          return;
        }

        gallery.photos.push({
          path: file.name,
          alt: "",
          caption: ""
        });
      });

      state.notice = "Added " + files.length + " photo name" + (files.length === 1 ? "" : "s") + ".";
      persistDraft();
      renderEditorForm();
      refreshStatus();
      refreshExportPreview();
    });

    elements.downloadDataButton.addEventListener("click", function () {
      const contents = buildExportFile();
      downloadFile("galleries.js", contents);
      state.notice = "Downloaded a new galleries.js file.";
      refreshStatus();
    });

    elements.copyDataButton.addEventListener("click", function () {
      const contents = buildExportFile();
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        state.notice = "Copy is not available here. Use the download button instead.";
        refreshStatus();
        return;
      }

      navigator.clipboard.writeText(contents).then(
        function () {
          state.notice = "Copied the generated data file to the clipboard.";
          refreshStatus();
        },
        function () {
          state.notice = "Copy failed here. Use the download button instead.";
          refreshStatus();
        }
      );
    });

    elements.resetDraftButton.addEventListener("click", function () {
      if (!window.confirm("Reset the editor back to the current published data?")) {
        return;
      }

      state.galleries = clone(publishedGalleries);
      state.selectedGalleryId = state.galleries[0] ? state.galleries[0].id : null;
      state.notice = "Reset the editor to the current published data.";
      clearDraft();
      render();
    });
  }

  function render() {
    renderGalleryList();
    renderEditorForm();
    refreshStatus();
    refreshExportPreview();
  }

  function renderGalleryList() {
    if (!state.galleries.length) {
      elements.galleryList.innerHTML =
        '<div class="empty-state"><p class="empty-note">No galleries yet. Start with <strong>New Gallery</strong>.</p></div>';
      return;
    }

    const duplicateSlugs = getDuplicateSlugs();

    elements.galleryList.innerHTML = state.galleries
      .map(function (gallery) {
        const photoCount = gallery.photos.filter(function (photo) {
          return photo.path.trim();
        }).length;
        const isActive = gallery.id === state.selectedGalleryId ? "gallery-list-button is-active" : "gallery-list-button";
        const badges = [];

        if (gallery.featured) {
          badges.push('<span class="badge badge-featured">Featured</span>');
        }

        if (!gallery.slug.trim() || !gallery.title.trim() || !photoCount) {
          badges.push('<span class="badge">Needs finishing</span>');
        }

        if (gallery.slug.trim() && duplicateSlugs.indexOf(gallery.slug.trim()) !== -1) {
          badges.push('<span class="badge">Duplicate slug</span>');
        }

        return (
          '<button class="' +
          isActive +
          '" type="button" data-gallery-id="' +
          gallery.id +
          '">' +
          '<span class="gallery-list-title">' +
          escapeHtml(gallery.title.trim() || "Untitled gallery") +
          "</span>" +
          '<span class="gallery-list-meta">' +
          photoCount +
          " photo" +
          (photoCount === 1 ? "" : "s") +
          (gallery.dateLabel.trim() ? " | " + escapeHtml(gallery.dateLabel.trim()) : "") +
          "</span>" +
          '<span class="gallery-list-badges">' +
          badges.join("") +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderEditorForm() {
    const gallery = getSelectedGallery();
    if (!gallery) {
      elements.editorFormRoot.innerHTML =
        '<div class="empty-state"><p class="empty-note">Create a gallery to start adding photos and details.</p></div>';
      return;
    }

    elements.editorFormRoot.innerHTML =
      '<div class="gallery-form">' +
      '<div class="form-grid">' +
      renderTextField("Gallery title", "title", gallery.title, "Favorite Moments") +
      renderTextField("Gallery slug", "slug", gallery.slug, "favorite-moments", "Used for the photo folder name and gallery link.") +
      renderTextField("Date label", "dateLabel", gallery.dateLabel, "Summer 2026") +
      renderNumberField("Year", "year", gallery.year, "2026") +
      renderTextField("Location", "location", gallery.location, "Paris, France") +
      renderTextField("Tags", "tagsText", gallery.tagsText, "Travel, Favorites", "Separate tags with commas.") +
      renderTextField("Cover image", "coverImage", gallery.coverImage, "cover.jpg", "Optional. Leave blank to use the first photo.") +
      renderCheckField("Featured gallery", "featured", gallery.featured, "Use this gallery for the homepage feature.") +
      renderTextAreaField("Description", "description", gallery.description, "A quick summary of the trip or event.") +
      "</div>" +
      '<p class="folder-note">Photo folder: <code id="folder-path">' +
      escapeHtml(getGalleryFolderPath(gallery)) +
      "</code></p>" +
      '<div class="section-block">' +
      '<div class="section-row">' +
      "<div>" +
      "<h3>Photos</h3>" +
      '<p class="field-note">Use file names like <span class="mono">01.jpg</span> or full image URLs.</p>' +
      "</div>" +
      '<div class="photo-actions">' +
      '<button class="button button-secondary" type="button" data-action="import-photo-files">Import File Names</button>' +
      '<button class="button button-dark" type="button" data-action="add-photo">Add Photo Row</button>' +
      "</div>" +
      "</div>" +
      '<div class="photo-list">' +
      renderPhotoList(gallery) +
      "</div>" +
      "</div>" +
      '<div class="section-block">' +
      '<button class="button danger-button" type="button" data-action="remove-gallery">Remove Gallery</button>' +
      "</div>" +
      "</div>";
  }

  function renderPhotoList(gallery) {
    if (!gallery.photos.length) {
      return '<div class="empty-state"><p class="empty-note">Add at least one photo row before publishing.</p></div>';
    }

    return gallery.photos
      .map(function (photo, index) {
        return (
          '<div class="photo-card">' +
          '<div class="photo-grid">' +
          renderPhotoField("File name or URL", "path", photo.path, "01.jpg", index) +
          renderPhotoField("Alt text", "alt", photo.alt, "Jeralyn at dinner", index) +
          renderPhotoField("Caption", "caption", photo.caption, "Birthday dinner", index) +
          '<button class="button button-secondary" type="button" data-action="remove-photo" data-photo-index="' +
          index +
          '">Remove</button>' +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderTextField(label, field, value, placeholder, note) {
    return (
      '<label class="field">' +
      '<span class="field-label">' +
      label +
      "</span>" +
      '<input type="text" data-field="' +
      field +
      '" value="' +
      escapeAttribute(value) +
      '" placeholder="' +
      escapeAttribute(placeholder || "") +
      '" />' +
      (note ? '<span class="field-note">' + escapeHtml(note) + "</span>" : "") +
      "</label>"
    );
  }

  function renderNumberField(label, field, value, placeholder) {
    return (
      '<label class="field">' +
      '<span class="field-label">' +
      label +
      "</span>" +
      '<input type="number" data-field="' +
      field +
      '" value="' +
      escapeAttribute(String(value || "")) +
      '" placeholder="' +
      escapeAttribute(placeholder || "") +
      '" />' +
      "</label>"
    );
  }

  function renderTextAreaField(label, field, value, placeholder) {
    return (
      '<label class="field is-full">' +
      '<span class="field-label">' +
      label +
      "</span>" +
      '<textarea data-field="' +
      field +
      '" placeholder="' +
      escapeAttribute(placeholder || "") +
      '">' +
      escapeHtml(value || "") +
      "</textarea>" +
      "</label>"
    );
  }

  function renderCheckField(label, field, checked, note) {
    return (
      '<label class="check-field">' +
      '<span class="field-label">' +
      label +
      "</span>" +
      '<span class="check-row"><input type="checkbox" data-field="' +
      field +
      '"' +
      (checked ? " checked" : "") +
      " /><span>" +
      escapeHtml(note) +
      "</span></span>" +
      "</label>"
    );
  }

  function renderPhotoField(label, field, value, placeholder, index) {
    return (
      '<label class="field">' +
      '<span class="field-label">' +
      label +
      "</span>" +
      '<input type="text" data-photo-field="' +
      field +
      '" data-photo-index="' +
      index +
      '" value="' +
      escapeAttribute(value) +
      '" placeholder="' +
      escapeAttribute(placeholder || "") +
      '" />' +
      "</label>"
    );
  }

  function updateGalleryField(gallery, input) {
    const field = input.getAttribute("data-field");

    if (field === "featured") {
      const isChecked = Boolean(input.checked);
      state.galleries.forEach(function (item) {
        item.featured = false;
      });
      gallery.featured = isChecked;
      state.notice = isChecked
        ? "Updated the featured gallery."
        : "Removed the featured gallery selection.";
      return;
    }

    if (field === "title") {
      const previousTitle = gallery.title;
      const previousAutoSlug = slugify(previousTitle);
      const nextTitle = input.value;
      gallery.title = nextTitle;

      if (!gallery.slug.trim() || gallery.slug.trim() === previousAutoSlug) {
        gallery.slug = slugify(nextTitle);
        const slugInput = elements.editorFormRoot.querySelector('[data-field="slug"]');
        if (slugInput) {
          slugInput.value = gallery.slug;
        }
      }

      return;
    }

    if (field === "year") {
      gallery.year = input.value;
      return;
    }

    gallery[field] = input.type === "checkbox" ? Boolean(input.checked) : input.value;
  }

  function updatePhotoField(gallery, input) {
    const index = Number(input.getAttribute("data-photo-index"));
    const field = input.getAttribute("data-photo-field");
    const photo = gallery.photos[index];

    if (!photo) {
      return;
    }

    photo[field] = input.value;
  }

  function removeSelectedGallery() {
    const index = state.galleries.findIndex(function (gallery) {
      return gallery.id === state.selectedGalleryId;
    });

    if (index === -1) {
      return;
    }

    state.galleries.splice(index, 1);
    state.selectedGalleryId = state.galleries[0] ? state.galleries[0].id : null;
    state.notice = "Removed the gallery from the editor.";
  }

  function refreshStatus() {
    const incompleteCount = state.galleries.filter(function (gallery) {
      return !gallery.slug.trim() || !gallery.title.trim() || !countFilledPhotos(gallery);
    }).length;
    const duplicateSlugs = getDuplicateSlugs();

    let message = "";

    if (!state.galleries.length) {
      message = "No galleries yet. Add one to get started.";
    } else if (!incompleteCount) {
      message = "All galleries are ready to publish.";
    } else if (incompleteCount === 1) {
      message = "1 gallery still needs a title, slug, and at least one photo before it will show on the site.";
    } else {
      message =
        incompleteCount +
        " galleries still need a title, slug, and at least one photo before they will show on the site.";
    }

    if (duplicateSlugs.length) {
      message +=
        " " +
        duplicateSlugs.length +
        " slug" +
        (duplicateSlugs.length === 1 ? " is" : "s are") +
        " duplicated. Each gallery needs its own folder slug.";
    }

    if (state.notice) {
      message += " " + state.notice;
    }

    elements.statusMessage.textContent = message.trim();
  }

  function refreshExportPreview() {
    elements.exportPreview.value = buildExportFile();
  }

  function refreshFolderPath() {
    const gallery = getSelectedGallery();
    const folderPath = elements.editorFormRoot.querySelector("#folder-path");
    if (!gallery || !folderPath) {
      return;
    }

    folderPath.textContent = getGalleryFolderPath(gallery);
  }

  function buildExportFile() {
    const payload = state.galleries.map(function (gallery) {
      return {
        slug: gallery.slug.trim(),
        title: gallery.title.trim(),
        dateLabel: gallery.dateLabel.trim(),
        year: Number(gallery.year) || new Date().getFullYear(),
        location: gallery.location.trim(),
        tags: splitTags(gallery.tagsText),
        description: gallery.description.trim(),
        featured: Boolean(gallery.featured),
        coverImage: gallery.coverImage.trim(),
        photos: gallery.photos
          .map(function (photo) {
            const path = photo.path.trim();
            if (!path) {
              return null;
            }

            const item = {
              alt: photo.alt.trim(),
              caption: photo.caption.trim()
            };

            if (looksLikeDirectSource(path)) {
              item.src = path;
            } else {
              item.fileName = path;
            }

            return item;
          })
          .filter(Boolean)
      };
    });

    return (
      "window.GALLERY_DATA = " +
      JSON.stringify(payload, null, 2) +
      ";\n"
    );
  }

  function downloadFile(fileName, contents) {
    const blob = new Blob([contents], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function persistDraft() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.galleries));
    } catch (error) {
      state.notice = "Browser draft saving is not available here.";
    }
  }

  function loadDraft() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      return hydrateEditorState(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      return;
    }
  }

  function getSelectedGallery() {
    return state.galleries.find(function (gallery) {
      return gallery.id === state.selectedGalleryId;
    });
  }

  function createEmptyGallery() {
    return {
      id: createId(),
      title: "",
      slug: "",
      dateLabel: "",
      year: String(new Date().getFullYear()),
      location: "",
      tagsText: "",
      description: "",
      featured: state.galleries.length === 0,
      coverImage: "",
      photos: [createEmptyPhoto()]
    };
  }

  function createEmptyPhoto() {
    return {
      path: "",
      alt: "",
      caption: ""
    };
  }

  function toEditorState(galleries) {
    return galleries.map(function (gallery) {
      return {
        id: createId(),
        title: gallery.title || "",
        slug: gallery.slug || "",
        dateLabel: gallery.dateLabel || "",
        year: String(gallery.year || ""),
        location: gallery.location || "",
        tagsText: Array.isArray(gallery.tags) ? gallery.tags.join(", ") : "",
        description: gallery.description || "",
        featured: Boolean(gallery.featured),
        coverImage: gallery.coverImage || "",
        photos: (gallery.photos || []).map(function (photo) {
          return {
            path: photo.fileName || photo.src || "",
            alt: photo.alt || "",
            caption: photo.caption || ""
          };
        })
      };
    });
  }

  function hydrateEditorState(galleries) {
    return (Array.isArray(galleries) ? galleries : []).map(function (gallery) {
      return {
        id: gallery.id || createId(),
        title: gallery.title || "",
        slug: gallery.slug || "",
        dateLabel: gallery.dateLabel || "",
        year: String(gallery.year || ""),
        location: gallery.location || "",
        tagsText: gallery.tagsText || "",
        description: gallery.description || "",
        featured: Boolean(gallery.featured),
        coverImage: gallery.coverImage || "",
        photos: Array.isArray(gallery.photos)
          ? gallery.photos.map(function (photo) {
              return {
                path: photo.path || "",
                alt: photo.alt || "",
                caption: photo.caption || ""
              };
            })
          : []
      };
    });
  }

  function getGalleryFolderPath(gallery) {
    return "assets/photos/" + (gallery.slug.trim() || "your-gallery-slug") + "/";
  }

  function countFilledPhotos(gallery) {
    return gallery.photos.filter(function (photo) {
      return photo.path.trim();
    }).length;
  }

  function splitTags(value) {
    return value
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function looksLikeDirectSource(value) {
    return (
      value.indexOf("http://") === 0 ||
      value.indexOf("https://") === 0 ||
      value.indexOf("data:") === 0 ||
      value.indexOf("/") === 0 ||
      value.indexOf("assets/") === 0
    );
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function createId() {
    return "gallery-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getDuplicateSlugs() {
    const counts = {};

    state.galleries.forEach(function (gallery) {
      const slug = gallery.slug.trim();
      if (!slug) {
        return;
      }

      counts[slug] = (counts[slug] || 0) + 1;
    });

    return Object.keys(counts).filter(function (slug) {
      return counts[slug] > 1;
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(String(value || ""));
  }
})();
