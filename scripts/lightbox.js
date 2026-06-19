/**
 * LightGallery v2 — PJAX-safe image lightbox
 * Uses dynamic mode (event delegation on document) so it survives
 * PJAX page transitions without needing to re-initialize.
 */
(function() {
  'use strict';

  var instance = null;

  function openGallery(items, index) {
    if (instance) {
      try { instance.destroy(); } catch(e) {}
      instance = null;
      // Clean up any leftover LG DOM
      var old = document.querySelector('.lg-backdrop');
      if (old) old.remove();
      old = document.querySelector('.lg-outer');
      if (old) old.remove();
    }

    // Create a transient container (never in the DOM)
    var container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);

    instance = lightGallery(container, {
      dynamic: true,
      dynamicEl: items,
      index: index,
      download: false,
      counter: false,
      speed: 400,
      plugins: [lgZoom],
      licenseKey: '0000-0000-0000-0000',
      mobileSettings: {
        controls: true,
        showCloseIcon: true,
        download: false
      }
    });

    instance.openGallery(index);

    instance.outer.addEventListener('lgAfterClose', function() {
      if (container.parentNode) container.parentNode.removeChild(container);
      if (instance) {
        try { instance.destroy(); } catch(e) {}
        instance = null;
      }
    });
  }

  document.addEventListener('click', function(e) {
    var img = e.target.closest('.post-content img');
    if (!img) return;

    // If inside an <a> link that points to an image, let the link handle it
    // (otherwise block the link and use lightbox)
    var link = img.closest('a');
    if (link) {
      var href = link.getAttribute('href') || '';
      if (/\.(jpe?g|png|webp|gif|svg|avif|bmp)(\?.*)?$/i.test(href)) {
        e.preventDefault();
        e.stopPropagation();
      }
      // Non-image link — don't intercept
    }

    e.preventDefault();
    e.stopPropagation();

    // Collect all images in .post-content
    var images = Array.from(document.querySelectorAll('.post-content img'));
    var idx = images.indexOf(img);
    if (idx < 0) idx = 0;

    var items = images.map(function(el) {
      var src = el.currentSrc || el.src || '';
      // Try data-src / data-original (lazy-loaded images)
      if (!src || src === window.location.href) {
        src = el.getAttribute('data-src') || el.getAttribute('data-original') || '';
      }
      return {
        src: src,
        thumb: src,
        subHtml: el.alt || ''
      };
    }).filter(function(item) { return item.src; });

    if (items.length === 0) return;

    openGallery(items, idx);
  });

})();
