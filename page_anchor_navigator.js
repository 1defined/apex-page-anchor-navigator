(function() {
    "use strict";

    var panNav = document.getElementById("page-pan");
    var panList = document.getElementById("pan-list");
    var indicator = document.getElementById("pan-indicator");
    if (!panNav || !panList) return;

   
    // Read plugin attributes
    var config = {
        scrollOffset: parseInt(panNav.getAttribute("data-scroll-offset")) || 100,
        animationSpeed: parseInt(panNav.getAttribute("data-animation-speed")) || 200,
        showParent: panNav.getAttribute("data-show-parent") !== "N",
        indicatorColor: panNav.getAttribute("data-indicator-color") || "#2563eb",
        trackColor: panNav.getAttribute("data-track-color") || "#d1d5db",
        textColor: panNav.getAttribute("data-text-color") || "#374151",
        showOverflow: panNav.getAttribute("data-show-overflow") !== "N"
    };

    var parentScrollBody = panNav.closest(".t-Region-body");

    if (parentScrollBody) {
        parentScrollBody.style.overflow = config.showOverflow ? "visible" : "hidden";
    };


    // Apply CSS variables
    panNav.style.setProperty("--pan-indicator-color", config.indicatorColor);
    panNav.style.setProperty("--pan-track-color", config.trackColor);
    panNav.style.setProperty("--pan-text-color", config.textColor);
    panNav.style.setProperty("--pan-animation-speed", config.animationSpeed + "ms");

    // --- Whitelist sanitizer ---
    var ALLOWED_LABEL_PATTERN = /^[\w\s\-\.\,\(\)\/#&:!?'\"À-ÿ]+$/;
    var MAX_LABEL_LENGTH = 100;

    function sanitizeLabel(text) {
        if (!text) return "";
        text = text.trim().substring(0, MAX_LABEL_LENGTH);
        if (!ALLOWED_LABEL_PATTERN.test(text)) {
            // Strip anything not whitelisted
            text = text.replace(/[^\w\s\-\.\,\(\)\/#&:!?'\"À-ÿ]/g, "");
        }
        return text;
    }

    function sanitizeId(id) {
        if (!id) return null;
        // IDs: only alphanumeric, hyphens, underscores
        if (!/^[a-zA-Z][\w\-]*$/.test(id)) return null;
        return id;
    }

    function sanitizeColor(color) {
        if (!color) return null;
        // Allow hex, rgb, rgba, hsl, named colors
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) return color;
        if (/^(rgb|rgba|hsl|hsla)\([\d\s,%.]+\)$/.test(color)) return color;
        if (/^[a-zA-Z]+$/.test(color)) return color;
        return null;
    }

    // Validate colors from attributes
    var validIndicator = sanitizeColor(config.indicatorColor);
    var validTrack = sanitizeColor(config.trackColor);
    var validText = sanitizeColor(config.textColor);
    if (validIndicator) panNav.style.setProperty("--pan-indicator-color", validIndicator);
    if (validTrack) panNav.style.setProperty("--pan-track-color", validTrack);
    if (validText) panNav.style.setProperty("--pan-text-color", validText);

    // --- Find regions ---
    var allRegions = document.querySelectorAll('[class*="js-pan"]');
    if (allRegions.length === 0) {
        panNav.style.display = "none";
        return;
    }

    var regions = [];
    allRegions.forEach(function(r) {
        if (!sanitizeId(r.id)) return;
        var hasClass = r.classList.contains("js-pan") || r.className.match(/js-pan-\d+/);
        if (hasClass) regions.push(r);
    });

    if (regions.length === 0) {
        panNav.style.display = "none";
        return;
    }

    function getLevel(el) {
        if (el.classList.contains("js-pan")) return 0;
        var match = el.className.match(/js-pan-(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    var fragment = document.createDocumentFragment();

    regions.forEach(function(r) {
        var id = sanitizeId(r.id);
        if (!id) return;

        var level = getLevel(r);

        // Label priority: data-js-pan-label > region title > heading > id
        var rawLabel = r.getAttribute("data-js-pan-label");
        if (!rawLabel) {
            // Try region title (APEX Universal Theme)
            var titleEl = r.querySelector(".t-Region-title, .t-Region-headerItems .t-Region-title");
            if (titleEl) {
                rawLabel = titleEl.textContent.trim();
            }
        }
        if (!rawLabel) {
            // Try any heading inside the region header
            var headingEl = r.querySelector("h1, h2, h3, h4, h5, h6");
            if (headingEl) {
                rawLabel = headingEl.textContent.trim();
            }
        }
        if (!rawLabel) {
            // Try aria-label on the region itself
            rawLabel = r.getAttribute("aria-label");
        }
        if (!rawLabel) {
            // Try the region's title attribute
            rawLabel = r.getAttribute("title");
        }
        // Last resort: convert id to readable text (replace - and _ with spaces)
        if (!rawLabel) {
            rawLabel = id.replace(/[-_]/g, " ");
        }
        
        var label = sanitizeLabel(rawLabel);
        if (!label) return;
        var li = document.createElement("li");
        li.setAttribute("data-level", level);
        li.style.paddingLeft = (level * 14) + "px";

        var a = document.createElement("a");
        a.href = "#" + id;
        a.setAttribute("data-pan-target", id);
        a.textContent = label;  

        li.appendChild(a);
        fragment.appendChild(li);
    });

    // Clear and append safely
    while (panList.firstChild) {
        panList.removeChild(panList.firstChild);
    }
    panList.appendChild(fragment);

    // --- Interaction ---
    var isManualScroll = false;

    panList.addEventListener("click", function(e) {
        var link = e.target.closest("a");
        if (!link) return;
        e.preventDefault();

        var targetId = sanitizeId(link.getAttribute("data-pan-target"));
        var target = targetId && document.getElementById(targetId);
        if (!target) return;

        var anchor = target.querySelector(".t-Region-header, .t-Region-title") || target;

        isManualScroll = true;
        setActive(targetId);
        anchor.scrollIntoView({ behavior: "smooth", block: "start" });

        setTimeout(function() { isManualScroll = false; }, 800);
    });

    function setActive(id) {
        panList.querySelectorAll("a").forEach(function(l) {
            l.classList.remove("is-current");
            l.classList.remove("is-current-parent");
        });

        var active = panList.querySelector('a[data-pan-target="' + CSS.escape(id) + '"]');
        if (!active) return;

        active.classList.add("is-current");

        if (config.showParent) {
            var item = active.closest("li");
            var level = parseInt(item.getAttribute("data-level") || "0");
            if (level > 0) {
                var prev = item.previousElementSibling;
                while (prev) {
                    var prevLevel = parseInt(prev.getAttribute("data-level") || "0");
                    if (prevLevel < level) {
                        var parentLink = prev.querySelector("a");
                        if (parentLink) parentLink.classList.add("is-current-parent");
                        level = prevLevel;
                        if (level === 0) break;
                    }
                    prev = prev.previousElementSibling;
                }
            }
        }

        if (indicator) moveIndicator(active);
    }

    function moveIndicator(activeLink) {
        var trackRect = document.querySelector(".pan-track").getBoundingClientRect();
        var linkRect = activeLink.getBoundingClientRect();

        var top = linkRect.top - trackRect.top;
        var bottom = linkRect.bottom - trackRect.top;

        var item = activeLink.closest("li");
        var level = parseInt(item.getAttribute("data-level") || "0");
        var next = item.nextElementSibling;
        while (next) {
            var nextLevel = parseInt(next.getAttribute("data-level") || "0");
            if (nextLevel <= level) break;
            var childLink = next.querySelector("a");
            if (childLink && (childLink.classList.contains("is-current") || childLink.classList.contains("is-current-parent"))) {
                bottom = childLink.getBoundingClientRect().bottom - trackRect.top;
            }
            next = next.nextElementSibling;
        }

        var parentLink = panList.querySelector("a.is-current-parent");
        if (parentLink) {
            var parentRect = parentLink.getBoundingClientRect();
            top = Math.min(top, parentRect.top - trackRect.top);
        }

        indicator.style.top = top + "px";
        indicator.style.height = (bottom - top) + "px";
    }

function onScroll() {
    if (isManualScroll) return;

    var nearBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 80);
    if (nearBottom) {
        setActive(regions[regions.length - 1].id);
        return;
    }

    var currentId = null;

    for (var i = regions.length - 1; i >= 0; i--) {
        // Use header if available, fallback to region root
        var anchor = regions[i].querySelector(".t-Region-header, .t-Region-title") || regions[i];
        var rect = anchor.getBoundingClientRect();
        if (rect.top <= config.scrollOffset) {
            currentId = regions[i].id;
            break;
        }
    }

    if (!currentId && window.scrollY > 10) {
        currentId = regions[0].id;
    }

    if (currentId) setActive(currentId);
}

    var scrollTimer;
    window.addEventListener("scroll", function() {
        if (scrollTimer) cancelAnimationFrame(scrollTimer);
        scrollTimer = requestAnimationFrame(onScroll);
    }, { passive: true });

    window.addEventListener("resize", function() {
        var current = panList.querySelector("a.is-current");
        if (current && indicator) moveIndicator(current);
    });

    onScroll();
})();