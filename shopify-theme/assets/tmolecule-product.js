(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // Thumb -> hero swap
    document.querySelectorAll('[data-tm-gallery]').forEach(function (gallery) {
      var hero = gallery.querySelector('[data-tm-hero]');
      gallery.querySelectorAll('[data-tm-thumb]').forEach(function (thumb) {
        thumb.addEventListener('click', function () {
          gallery.querySelectorAll('[data-tm-thumb]').forEach(function (x) {
            x.classList.remove('is-active');
          });
          thumb.classList.add('is-active');
          if (hero) hero.src = thumb.dataset.full || thumb.src;
        });
      });
    });

    // Pack variant selection — updates hidden id input, price, and sticky price
    document.querySelectorAll('[data-tm-variant]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var form = btn.closest('form');
        if (!form) return;
        form.querySelectorAll('[data-tm-variant]').forEach(function (x) {
          x.classList.remove('is-active');
        });
        btn.classList.add('is-active');
        var id = btn.dataset.variantId;
        var price = btn.dataset.variantPrice;
        var hidden = form.querySelector('input[name="id"]');
        if (hidden && id) hidden.value = id;
        var priceEl = form.querySelector('[data-tm-price]');
        if (priceEl && price) priceEl.textContent = price;
        var stickyPrice = document.querySelector('[data-tm-sticky-price]');
        if (stickyPrice && price) stickyPrice.firstChild.nodeValue = price;
      });
    });

    // Generic picker toggle — any button group in .tm-buybox__opts becomes clickable
    document.querySelectorAll('.tm-buybox__opts').forEach(function (group) {
      group.querySelectorAll('button[type="button"]').forEach(function (btn) {
        if (btn.hasAttribute('data-tm-variant')) return; // variant picker handled above
        btn.addEventListener('click', function () {
          group.querySelectorAll('button[type="button"]').forEach(function (x) {
            x.classList.remove('is-active');
          });
          btn.classList.add('is-active');

          // If this is a subscribe toggle, update the hidden selling_plan input
          if (btn.hasAttribute('data-tm-subscribe')) {
            var form = btn.closest('form');
            if (!form) return;
            var hidden = form.querySelector('[data-tm-selling-plan]');
            if (hidden) {
              hidden.value = btn.dataset.planId || '';
            }
          }
        });
      });
    });

    // Video modal: click teaser play button -> open full video
    document.querySelectorAll('[data-tm-video]').forEach(function (wrap) {
      var modal = wrap.parentElement.querySelector('[data-tm-video-modal]');
      var full = modal ? modal.querySelector('video') : null;
      var open = wrap.querySelector('[data-tm-video-open]');
      var close = modal ? modal.querySelector('[data-tm-video-close]') : null;
      if (open && modal && full) {
        open.addEventListener('click', function () {
          modal.hidden = false;
          full.play();
        });
      }
      if (close && modal && full) {
        close.addEventListener('click', function () {
          full.pause();
          modal.hidden = true;
        });
        modal.addEventListener('click', function (e) {
          if (e.target === modal) {
            full.pause();
            modal.hidden = true;
          }
        });
      }
    });

    // Sticky CTA — reveal after main ATC scrolls out of view
    var sticky = document.querySelector('.tm-sticky-cta');
    var trigger = document.querySelector('.tm-buybox__cta');
    if (sticky && trigger && 'IntersectionObserver' in window) {
      document.body.classList.add('tm-has-sticky');
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            sticky.classList.toggle('is-visible', !e.isIntersecting);
          });
        },
        { rootMargin: '0px 0px -40% 0px' },
      );
      io.observe(trigger);
    }

    // Sticky ATC — delegate click to the main buy-box submit so
    // the currently selected variant / subscription plan is added.
    document.querySelectorAll('[data-tm-sticky-atc]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var mainBtn = document.querySelector('.tm-buybox__cta');
        if (mainBtn) {
          mainBtn.click();
        } else {
          window.location.hash = '#top';
        }
      });
    });
  });
})();
