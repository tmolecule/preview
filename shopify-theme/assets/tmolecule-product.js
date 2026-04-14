(function(){
  document.addEventListener('DOMContentLoaded', function(){
    // Thumb -> hero swap
    document.querySelectorAll('[data-tm-gallery]').forEach(function(gallery){
      var hero = gallery.querySelector('[data-tm-hero]');
      gallery.querySelectorAll('[data-tm-thumb]').forEach(function(thumb){
        thumb.addEventListener('click', function(){
          gallery.querySelectorAll('[data-tm-thumb]').forEach(function(x){ x.classList.remove('is-active'); });
          thumb.classList.add('is-active');
          if (hero) hero.src = thumb.dataset.full || thumb.src;
        });
      });
    });

    // Pack variant selection — updates hidden id input, price, and sticky price
    document.querySelectorAll('[data-tm-variant]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var form = btn.closest('form');
        if (!form) return;
        form.querySelectorAll('[data-tm-variant]').forEach(function(x){ x.classList.remove('is-active'); });
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

    // Video modal: click teaser play button -> open full video
    document.querySelectorAll('[data-tm-video]').forEach(function(wrap){
      var modal = wrap.parentElement.querySelector('[data-tm-video-modal]');
      var full = modal ? modal.querySelector('video') : null;
      var open = wrap.querySelector('[data-tm-video-open]');
      var close = modal ? modal.querySelector('[data-tm-video-close]') : null;
      if (open && modal && full) {
        open.addEventListener('click', function(){
          modal.hidden = false;
          full.play();
        });
      }
      if (close && modal && full) {
        close.addEventListener('click', function(){
          full.pause();
          modal.hidden = true;
        });
        modal.addEventListener('click', function(e){
          if (e.target === modal) { full.pause(); modal.hidden = true; }
        });
      }
    });

    // Sticky CTA — reveal after main ATC scrolls out of view
    var sticky = document.querySelector('.tm-sticky-cta');
    var trigger = document.querySelector('.tm-buybox__cta');
    if (sticky && trigger && 'IntersectionObserver' in window) {
      document.body.classList.add('tm-has-sticky');
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          sticky.classList.toggle('is-visible', !e.isIntersecting);
        });
      }, { rootMargin: '0px 0px -40% 0px' });
      io.observe(trigger);
    }
  });
})();
