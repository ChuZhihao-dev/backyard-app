(function () {
  function setup(root) {
    var button = root.querySelector("[data-by-designer-open]");
    var dialog = root.querySelector("[data-by-designer-dialog]");
    var frame = root.querySelector("[data-by-designer-frame]");
    if (!button || !dialog || !frame) return;

    var url = root.getAttribute("data-url") || "/apps/backyard-designer";
    var openIn = root.getAttribute("data-open-in") || "overlay";
    var frameLoaded = false;

    function lockScroll() {
      document.documentElement.classList.add("by-designer-open");
    }

    function unlockScroll() {
      document.documentElement.classList.remove("by-designer-open");
    }

    function openOverlay() {
      if (!frameLoaded) {
        frame.src = url;
        frameLoaded = true;
      }
      if (typeof dialog.showModal === "function") {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      lockScroll();
    }

    function closeOverlay() {
      if (typeof dialog.close === "function") {
        if (dialog.open) dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
      unlockScroll();
    }

    button.addEventListener("click", function (event) {
      event.preventDefault();
      if (openIn === "new_tab") {
        window.open(url, "_blank", "noopener");
        return;
      }
      openOverlay();
    });

    var closeButton = root.querySelector("[data-by-designer-close]");
    if (closeButton) closeButton.addEventListener("click", closeOverlay);

    dialog.addEventListener("close", unlockScroll);

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeOverlay();
    });
  }

  function ready() {
    var roots = document.querySelectorAll("[data-by-designer]");
    for (var i = 0; i < roots.length; i += 1) setup(roots[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
