
document.addEventListener("DOMContentLoaded", () => {
    const hamburger = document.getElementById("hamburger");
    const mobileMenu = document.getElementById("mobile-menu");

    if (hamburger && mobileMenu) {
        hamburger.addEventListener("click", () => {
            const isHidden = mobileMenu.classList.toggle("hidden");

            hamburger.setAttribute("aria-expanded", String(!isHidden));
        });
    }

    const categoriesToggle = document.getElementById("categories-toggle");
    const categoriesList = document.getElementById("categories-list");
    const categoriesArrow = document.getElementById("categories-arrow");

    if (categoriesToggle && categoriesList) {
        categoriesToggle.addEventListener("click", () => {
            const isHidden = categoriesList.classList.toggle("hidden");

            categoriesList.classList.toggle("flex", !isHidden);
            categoriesToggle.setAttribute("aria-expanded", String(!isHidden));

            if (categoriesArrow) {
                categoriesArrow.textContent = isHidden ? "+" : "−";
            }
        });
    }

    
    // Open the Categories dropdown when an About page pill is clicked
    const categoryPills = document.querySelectorAll(".category-pill");

    categoryPills.forEach(pill => {
        pill.addEventListener("click", () => {
            const categoriesToggle = document.getElementById("categories-toggle");
            const categoriesList = document.getElementById("categories-list");
            const categoriesArrow = document.getElementById("categories-arrow");
            const mobileMenu = document.getElementById("mobile-menu");

            if (!categoriesToggle || !categoriesList) return;

            // Open the hamburger menu if it is closed
            if (mobileMenu && mobileMenu.classList.contains("hidden")) {
                mobileMenu.classList.remove("hidden");

                const hamburger = document.getElementById("hamburger");
                if (hamburger) {
                    hamburger.setAttribute("aria-expanded", "true");
                }
            }

            // Open the Categories dropdown if it is closed
            if (categoriesList.classList.contains("hidden")) {
                categoriesList.classList.remove("hidden");
                categoriesList.classList.add("flex");
                categoriesToggle.setAttribute("aria-expanded", "true");

                if (categoriesArrow) {
                    categoriesArrow.textContent = "−";
                }
            }

            // Scroll to the Categories dropdown
            categoriesToggle.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        });
    });

});



// Logout confirmation modal
const logoutModal = document.getElementById("logout-modal");
const cancelLogout = document.getElementById("cancel-logout");
const confirmLogout = document.getElementById("confirm-logout");

// Intercept clicks on Logout links
document.querySelectorAll('a[href="/logout"]').forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();

        if (logoutModal) {
            logoutModal.classList.remove("hidden");
            logoutModal.classList.add("flex");
        }
    });
});

// Cancel logout
if (cancelLogout && logoutModal) {
    cancelLogout.addEventListener("click", () => {
        logoutModal.classList.add("hidden");
        logoutModal.classList.remove("flex");
    });
}


// Confirm logout
if (confirmLogout) {
    confirmLogout.addEventListener("click", () => {
        const csrfToken = logoutModal?.dataset.csrfToken;

        fetch("/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                _csrf: csrfToken
            })
        })
            .then(response => {
                if (response.redirected) {
                    window.location.href = response.url;
                } else if (response.ok) {
                    window.location.href = "/";
                } else {
                    alert("Unable to log out. Please try again.");
                }
            })
            .catch(() => {
                alert("Unable to log out. Please try again.");
            });
    });
}


// Close modal when clicking outside the box
if (logoutModal) {
    logoutModal.addEventListener("click", event => {
        if (event.target === logoutModal) {
            logoutModal.classList.add("hidden");
            logoutModal.classList.remove("flex");
        }
    });
}
