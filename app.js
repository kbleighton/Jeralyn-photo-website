(function () {
  const galleries = normalizeGalleries(
    Array.isArray(window.GALLERY_DATA) ? window.GALLERY_DATA : []
  );

  const elements = {
    hero: document.getElementById("hero"),
    statsGrid: document.getElementById("stats-grid"),
    tagFilters: document.getElementById("tag-filters"),
    galleryGrid: document.getElementById("gallery-grid"),
    galleryDetail: document.getElementById("gallery-detail"),
    galleryDetailContent: document.getElementById("gallery-detail-content"),
    featuredGalleryButton: document.getElementById("featured-gallery-button"),
    lightbox: document.getElementById("lightbox"),
    lightboxImage: document.getElementById("lightbox-image"),
    lightboxCaption: document.getElementById("lightbox-caption"),
    lightboxClose: document.getElementById("lightbox-close"),
    lightboxPrev: document.getElementById("lightbox-prev"),
    lightboxNext: document.getElementById("lightbox-next")
  };

  const state = {
    activeTag: "All",
    activeGallerySlug: getGallerySlugFromHash(),
    activePhotoIndex: 0
  };

  function init() {
    if (!galleries.length) {
      renderEmptyState();
      return;
    }

    renderHero();
    renderStats();
    renderFilters();
    renderGalleryGrid();
    renderGalleryDetail();
    bindEvents();
  }

  function normalizeGalleries(rawGalleries) {
    return rawGalleries
      .map(function (gallery) {
        return normalizeGallery(gallery);
      })
      .filter(function (gallery) {
        return gallery.slug && gallery.title && gallery.photos.length;
      });
  }

  function normalizeGallery(gallery) {
    const photoDirectory = gallery.photoDirectory || gallery.slug || "";
    const photos = (gallery.photos || [])
      .map(function (photo, index) {
        return normalizePhoto(photo, photoDirectory, gallery.title, index);
      })
      .filter(function (photo) {
        return photo.src;
      });

    return {
      slug: gallery.slug || "",
      title: gallery.title || "Untitled Gallery",
      dateLabel: gallery.dateLabel || "",
      year: Number(gallery.year) || new Date().getFullYear(),
      location: gallery.location || "",
      tags: Array.isArray(gallery.tags) ? gallery.tags : [],
      description: gallery.description || "",
      featured: Boolean(gallery.featured),
      photoDirectory: photoDirectory,
      coverImage: resolveImagePath(gallery.coverImage || (photos[0] && photos[0].src) || "", photoDirectory),
      photos: photos
    };
  }

  function normalizePhoto(photo, photoDirectory, galleryTitle, index) {
    const src = resolveImagePath(photo.src || photo.fileName || "", photoDirectory);
    return {
      src: src,
      alt: photo.alt || galleryTitle + " photo " + (index + 1),
      caption: photo.caption || ""
    };
  }

  function resolveImagePath(value, photoDirectory) {
    if (!value) {
      return "";
    }

    if (
      value.indexOf("http://") === 0 ||
      value.indexOf("https://") === 0 ||
      value.indexOf("data:") === 0 ||
      value.indexOf("/") === 0 ||
      value.indexOf("assets/") === 0
    ) {
      return value;
    }

    return "assets/photos/" + photoDirectory + "/" + value;
  }

  function bindEvents() {
    elements.featuredGalleryButton.addEventListener("click", function () {
      const featured = galleries.find(function (gallery) {
        return gallery.featured;
      }) || galleries[0];

      openGallery(featured.slug);
    });

    elements.tagFilters.addEventListener("click", function (event) {
      const button = event.target.closest("[data-tag]");
      if (!button) {
        return;
      }

      state.activeTag = button.getAttribute("data-tag");
      renderFilters();
      renderGalleryGrid();
    });

    elements.galleryGrid.addEventListener("click", function (event) {
      const button = event.target.closest("[data-gallery-slug]");
      if (!button) {
        return;
      }

      openGallery(button.getAttribute("data-gallery-slug"));
    });

    elements.galleryDetailContent.addEventListener("click", function (event) {
      const photoButton = event.target.closest("[data-photo-index]");
      if (photoButton) {
        state.activePhotoIndex = Number(photoButton.getAttribute("data-photo-index"));
        openLightbox();
        return;
      }

      const closeButton = event.target.closest("[data-close-gallery]");
      if (closeButton) {
        closeGallery();
      }
    });

    window.addEventListener("hashchange", function () {
      state.activeGallerySlug = getGallerySlugFromHash();
      renderGalleryDetail();
      highlightActiveCard();
    });

    elements.lightbox.addEventListener("click", function (event) {
      if (event.target === elements.lightbox) {
        closeLightbox();
      }
    });

    elements.lightboxClose.addEventListener("click", closeLightbox);
    elements.lightboxPrev.addEventListener("click", function () {
      stepPhoto(-1);
    });
    elements.lightboxNext.addEventListener("click", function () {
      stepPhoto(1);
    });

    document.addEventListener("keydown", function (event) {
      if (elements.lightbox.classList.contains("is-hidden")) {
        return;
      }

      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        stepPhoto(-1);
      } else if (event.key === "ArrowRight") {
        stepPhoto(1);
      }
    });
  }

  function renderHero() {
    const featured = galleries.find(function (gallery) {
      return gallery.featured;
    }) || galleries[0];

    elements.hero.style.setProperty("--hero-image", 'url("' + featured.coverImage + '")');
  }

  function renderStats() {
    const photoCount = galleries.reduce(function (sum, gallery) {
      return sum + gallery.photos.length;
    }, 0);

    const years = galleries.map(function (gallery) {
      return gallery.year;
    });

    const newestYear = Math.max.apply(null, years);
    const oldestYear = Math.min.apply(null, years);

    const stats = [
      { value: String(galleries.length), label: "gallery groups" },
      { value: String(photoCount), label: "photos" },
      {
        value: oldestYear === newestYear ? String(newestYear) : oldestYear + " to " + newestYear,
        label: "timeline span"
      },
      {
        value: galleries.filter(function (gallery) { return gallery.featured; }).length ? "1" : "0",
        label: "featured gallery"
      }
    ];

    elements.statsGrid.innerHTML = stats
      .map(function (stat) {
        return (
          '<div class="stat"><span class="stat-value">' +
          stat.value +
          '</span><span class="stat-label">' +
          stat.label +
          "</span></div>"
        );
      })
      .join("");
  }

  function renderFilters() {
    const tags = ["All"].concat(
      Array.from(
        new Set(
          galleries.reduce(function (allTags, gallery) {
            return allTags.concat(gallery.tags);
          }, [])
        )
      )
    );

    elements.tagFilters.innerHTML = tags
      .map(function (tag) {
        const activeClass = tag === state.activeTag ? "filter-button is-active" : "filter-button";

        return (
          '<button class="' +
          activeClass +
          '" type="button" data-tag="' +
          tag +
          '">' +
          tag +
          "</button>"
        );
      })
      .join("");
  }

  function renderGalleryGrid() {
    const visibleGalleries = galleries.filter(function (gallery) {
      return state.activeTag === "All" || gallery.tags.indexOf(state.activeTag) !== -1;
    });

    if (!visibleGalleries.length) {
      elements.galleryGrid.innerHTML =
        '<p class="empty-state">No galleries match this filter yet.</p>';
      return;
    }

    elements.galleryGrid.innerHTML = visibleGalleries
      .map(function (gallery) {
        return (
          '<button class="gallery-card" type="button" data-gallery-slug="' +
          gallery.slug +
          '">' +
          '<img class="gallery-card-media" src="' +
          gallery.coverImage +
          '" alt="' +
          escapeHtml(gallery.title) +
          ' cover photo" loading="lazy" />' +
          '<div class="gallery-card-copy">' +
          '<p class="gallery-card-meta">' +
          escapeHtml(gallery.dateLabel) +
          " | " +
          escapeHtml(gallery.location) +
          "</p>" +
          '<h3 class="gallery-card-title">' +
          escapeHtml(gallery.title) +
          "</h3>" +
          '<p class="gallery-card-description">' +
          escapeHtml(gallery.description) +
          "</p>" +
          '<div class="tag-list">' +
          gallery.tags
            .map(function (tag) {
              return '<span class="tag">' + escapeHtml(tag) + "</span>";
            })
            .join("") +
          "</div>" +
          "</div>" +
          "</button>"
        );
      })
      .join("");

    highlightActiveCard();
  }

  function renderGalleryDetail() {
    const gallery = getActiveGallery();
    if (!gallery) {
      elements.galleryDetail.classList.add("is-hidden");
      elements.galleryDetailContent.innerHTML = "";
      return;
    }

    elements.galleryDetail.classList.remove("is-hidden");
    elements.galleryDetailContent.innerHTML =
      '<div class="detail-header">' +
      "<div>" +
      '<p class="section-label">Selected gallery</p>' +
      "<h2>" +
      escapeHtml(gallery.title) +
      "</h2>" +
      '<div class="detail-meta">' +
      "<span>" +
      escapeHtml(gallery.dateLabel) +
      "</span>" +
      "<span>" +
      escapeHtml(gallery.location) +
      "</span>" +
      "<span>" +
      gallery.photos.length +
      " photos</span>" +
      "</div>" +
      "<p>" +
      escapeHtml(gallery.description) +
      "</p>" +
      '<div class="tag-list">' +
      gallery.tags
        .map(function (tag) {
          return '<span class="tag">' + escapeHtml(tag) + "</span>";
        })
        .join("") +
      "</div>" +
      "</div>" +
      "<div>" +
      '<button class="detail-close" type="button" data-close-gallery="true">Close gallery</button>' +
      "</div>" +
      "</div>" +
      '<img class="detail-cover" src="' +
      gallery.coverImage +
      '" alt="' +
      escapeHtml(gallery.title) +
      ' cover photo" loading="lazy" />' +
      '<div class="photo-grid">' +
      gallery.photos
        .map(function (photo, index) {
          return (
            '<button class="photo-button" type="button" data-photo-index="' +
            index +
            '">' +
            '<img class="photo-image" src="' +
            photo.src +
            '" alt="' +
            escapeHtml(photo.alt) +
            '" loading="lazy" />' +
            '<div class="photo-copy"><p class="photo-caption">' +
            escapeHtml(photo.caption || photo.alt) +
            "</p></div>" +
            "</button>"
          );
        })
        .join("") +
      "</div>";

    elements.galleryDetail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderEmptyState() {
    elements.statsGrid.innerHTML = "";
    elements.tagFilters.innerHTML = "";
    elements.galleryGrid.innerHTML =
      '<p class="empty-state">Add gallery data in <code>data/galleries.js</code> to get started.</p>';
  }

  function openGallery(slug) {
    window.location.hash = "gallery/" + slug;
  }

  function closeGallery() {
    window.location.hash = "galleries";
  }

  function getActiveGallery() {
    return galleries.find(function (gallery) {
      return gallery.slug === state.activeGallerySlug;
    });
  }

  function getGallerySlugFromHash() {
    if (!window.location.hash.startsWith("#gallery/")) {
      return "";
    }

    return window.location.hash.replace("#gallery/", "");
  }

  function highlightActiveCard() {
    const cards = elements.galleryGrid.querySelectorAll("[data-gallery-slug]");
    cards.forEach(function (card) {
      if (card.getAttribute("data-gallery-slug") === state.activeGallerySlug) {
        card.style.borderColor = "rgba(179, 93, 66, 0.65)";
      } else {
        card.style.borderColor = "";
      }
    });
  }

  function openLightbox() {
    const gallery = getActiveGallery();
    if (!gallery) {
      return;
    }

    const photo = gallery.photos[state.activePhotoIndex];
    if (!photo) {
      return;
    }

    elements.lightboxImage.src = photo.src;
    elements.lightboxImage.alt = photo.alt;
    elements.lightboxCaption.textContent = photo.caption || photo.alt;
    elements.lightbox.classList.remove("is-hidden");
    elements.lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    elements.lightbox.classList.add("is-hidden");
    elements.lightbox.setAttribute("aria-hidden", "true");
    elements.lightboxImage.src = "";
    elements.lightboxImage.alt = "";
    elements.lightboxCaption.textContent = "";
  }

  function stepPhoto(direction) {
    const gallery = getActiveGallery();
    if (!gallery) {
      return;
    }

    const photoCount = gallery.photos.length;
    state.activePhotoIndex = (state.activePhotoIndex + direction + photoCount) % photoCount;
    openLightbox();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  init();
})();
