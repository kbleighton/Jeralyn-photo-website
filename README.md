# Jeralyn Photo Website

Starter site for a photo-focused website that can later be rebuilt inside WordPress.

## What is here

- A static homepage with a featured hero, gallery browser, and photo detail view
- A single content file at `data/galleries.js` that drives the site
- A lightweight structure that is easy to translate into WordPress galleries or custom post types later

## File structure

- `index.html` - page markup
- `styles.css` - site styling
- `app.js` - gallery rendering, filters, hash-based selection, and lightbox
- `editor.html` - form-based content editor for non-technical updates
- `editor.js` - editor behavior and export logic
- `editor.css` - editor styling
- `data/galleries.js` - the gallery content that powers the site
- `assets/photos/` - local photo folder for future real images

## Open the site

Open `index.html` directly in a browser. No build step is required for this starter.

## Easiest workflow for Jeralyn

Open `editor.html` in a browser. It gives her a form-based editor for galleries and photos so she does not need to edit JavaScript directly.

The simplest routine is:

1. Put photos into `assets/photos/<gallery-slug>/`
2. Open `editor.html`
3. Add or update the gallery details and photo filenames
4. Download the new `galleries.js` file
5. Replace `data/galleries.js` with the downloaded file

The editor also keeps a browser draft while she is working.

## Manual content workflow

The site is set up so content updates stay simple:

- Add image files into `assets/photos/<gallery-slug>/`
- Add photo entries in `data/galleries.js`
- For a brand-new gallery, copy one existing gallery object and update the values

The app automatically resolves local filenames like `01.jpg` to:

`assets/photos/<gallery-slug>/01.jpg`

It also uses the first photo as the gallery cover unless you set `coverImage` yourself.

## Add photos to an existing gallery by hand

1. Find the gallery in `data/galleries.js`
2. Drop more images into `assets/photos/<gallery-slug>/`
3. Add more photo objects to that gallery's `photos` array

Example:

```js
photos: [
  {
    fileName: "01.jpg",
    alt: "Jeralyn arriving at dinner",
    caption: "Dinner reservation view"
  },
  {
    fileName: "02.jpg",
    alt: "Candles on the cake",
    caption: "Birthday cake"
  },
  {
    fileName: "03.jpg",
    alt: "Group photo at the table",
    caption: "End of the night"
  }
]
```

## Add a new gallery by hand

1. Create a folder in `assets/photos/` using the new gallery slug
2. Copy one gallery object in `data/galleries.js`
3. Fill in `slug`, `title`, `dateLabel`, `year`, `location`, `tags`, and `description`
4. Add photo objects for the images in that folder

Example:

```js
{
  slug: "paris-spring",
  title: "Paris in Spring",
  dateLabel: "April 2026",
  year: 2026,
  location: "Paris, France",
  tags: ["Travel"],
  description: "Cafe stops, museum afternoons, and a lot of walking.",
  featured: false,
  photos: [
    {
      fileName: "01.jpg",
      alt: "Jeralyn outside a cafe in Paris",
      caption: "First morning in the city"
    },
    {
      fileName: "02.jpg",
      alt: "Walking near the river",
      caption: "Late afternoon light"
    }
  ]
}
```

## Working with real photos

The site now includes a first real album in `assets/photos/day-with-shai/`.

To add more:

1. Create a folder in `assets/photos/` using the gallery slug
2. Add image files there
3. Add another gallery in `editor.html` or `data/galleries.js`
4. List the image file names in that gallery's `photos` array

## WordPress migration notes

This starter is already organized in a way that maps cleanly to WordPress:

- Each gallery object can become a gallery post or custom post type entry
- Tags can become WordPress categories or custom taxonomies
- The `photos` array can become a gallery block, attachment set, or ACF repeater
- The hero and featured gallery can become theme options or homepage fields

That keeps the content model stable even when the rendering layer changes later.
