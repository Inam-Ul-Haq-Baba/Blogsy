const hamburger = document.body.querySelector(".hamburger");
const mobileMenu = document.getElementById("mobile-menu");

hamburger.addEventListener("click",()=>{
    mobileMenu.classList.toggle("hidden")
})