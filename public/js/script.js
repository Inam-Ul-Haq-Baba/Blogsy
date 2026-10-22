
document.addEventListener("DOMContentLoaded", () => {
    const successMessage = document.getElementById("success-message");

    if (successMessage) {
        setTimeout(() => {
            successMessage.style.transition = "opacity 0.5s ease";
            successMessage.style.opacity = "0";

            setTimeout(() => {
                successMessage.remove();
            }, 500);
        }, 3000);
    }


    const postImage = document.getElementById("post-full-image");
    const imageViewer = document.getElementById("image-viewer");
    const viewerImage = document.getElementById("viewer-image");
    const closeImageViewer = document.getElementById("close-image-viewer");

    if (postImage && imageViewer && viewerImage && closeImageViewer) {
        const closeViewer = () => {
            imageViewer.classList.add("hidden");
            imageViewer.classList.remove("flex");
            viewerImage.src = "";
        };

        postImage.addEventListener("click", () => {
            viewerImage.src = postImage.src;
            viewerImage.alt = postImage.alt;
            imageViewer.classList.remove("hidden");
            imageViewer.classList.add("flex");
        });

        closeImageViewer.addEventListener("click", closeViewer);

        imageViewer.addEventListener("click", event => {
            if (event.target === imageViewer) {
                closeViewer();
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeViewer();
            }
        });
    }



    document.querySelectorAll(".card-like-button").forEach(button => {
        button.addEventListener("click", async () => {
            const postId = button.dataset.postId;
            const csrfToken =
                document.querySelector('input[name="_csrf"]')?.value ||
                document.getElementById("logout-modal")?.dataset.csrfToken;

            if (!csrfToken) {
                alert("Security token missing. Please refresh the page.");
                return;
            }

            button.disabled = true;

            try {
                const response = await fetch(`/posts/${postId}/like`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: new URLSearchParams({
                        _csrf: csrfToken
                    })
                });

                
                const result = await response.json();

                if (response.status === 401) {
                    alert("Please log in to like a blog.");
                    window.location.href = "/login";
                    return;
                }

                if (!response.ok || !result.success) {
                    alert(result.message || "Unable to update like.");
                    return;
                }


                button.dataset.liked = String(result.liked);
                button.setAttribute("aria-pressed", String(result.liked));

                const icon = button.querySelector(".card-like-icon");
                const count = button.querySelector(".card-like-count");

                if (icon) {
                    icon.setAttribute(
                        "fill",
                        result.liked ? "currentColor" : "none"
                    );
                }

                if (count) {
                    count.textContent = result.likeCount;
                }

                button.classList.toggle("text-green-600", result.liked);
                button.classList.toggle("text-gray-600", !result.liked);

            } catch (error) {
                alert("Something went wrong. Please try again.");
            } finally {
                button.disabled = false;
            }
        });
    });


});



const likeButton = document.getElementById("like-button");

if (likeButton) {
    likeButton.addEventListener("click", async () => {
        const postId = likeButton.dataset.postId;
        const csrfToken = document.querySelector(
            'input[name="_csrf"]'
        )?.value || document.getElementById("logout-modal")?.dataset.csrfToken;

        if (!csrfToken) {
            alert("Security token missing. Please refresh the page.");
            return;
        }

        likeButton.disabled = true;

        try {
            const response = await fetch(`/posts/${postId}/like`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    _csrf: csrfToken
                })
            });

            const result = await response.json();

            
            if (response.status === 401) {
                alert("Please log in to like this blog.");
                window.location.href = "/login";
                return;
            }

            if (!response.ok || !result.success) {
                alert(result.message || "Unable to update like.");
                return;
            }


            likeButton.dataset.liked = String(result.liked);
            likeButton.setAttribute("aria-pressed", String(result.liked));

            document.getElementById("like-icon").textContent =
                result.liked ? "♥" : "♡";

            document.getElementById("like-count").textContent =
                result.likeCount;

            likeButton.classList.toggle("text-green-600", result.liked);
            likeButton.classList.toggle("text-gray-600", !result.liked);

        } catch (error) {
            alert("Something went wrong. Please try again.");
        } finally {
            likeButton.disabled = false;
        }
    });
}



// Function for "Show Password"
function togglePassword(inputId, button) {
    const passwordInput = document.getElementById(inputId);
    const isPasswordHidden = passwordInput.type === "password";

    passwordInput.type = isPasswordHidden ? "text" : "password";

    button.setAttribute(
        "aria-label",
        isPasswordHidden ? "Hide password" : "Show password"
    );
}
