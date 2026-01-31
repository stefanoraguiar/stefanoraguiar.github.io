document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. LIGHTBOX LOGIC (Gallery Zoom)
    // ==========================================
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.close-lightbox');
    const triggers = document.querySelectorAll('.gallery-trigger');

    // Only run if lightbox exists on this page
    if (lightbox) {
        // Open Lightbox
        triggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault(); // Stop the link from navigating away
                const fullSizeSrc = trigger.getAttribute('href'); // Get the 2500px URL
                
                lightboxImg.src = fullSizeSrc; // Swap the image
                lightbox.classList.add('active'); // Show the modal
                document.body.style.overflow = 'hidden'; // Stop background scrolling
            });
        });

        // Close Lightbox (Clicking X or the background)
        const closeLightbox = () => {
            lightbox.classList.remove('active');
            document.body.style.overflow = 'auto'; // Re-enable scrolling
            setTimeout(() => { lightboxImg.src = ''; }, 300); // Clear image after fade out
        };

        if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
        
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) { // Only close if clicking outside the image
                closeLightbox();
            }
        });

        // Close on Escape Key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                closeLightbox();
            }
        });
    }


    // ==========================================
    // 2. MOBILE MENU LOGIC (Hamburger)
    // ==========================================
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const links = document.querySelectorAll('.nav-links li');
    const dropdown = document.querySelector('.dropdown');
    const dropBtn = document.querySelector('.dropbtn');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            // Toggle the menu
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');

            // Animate Links Fade In
            links.forEach((link, index) => {
                if (link.style.animation) {
                    link.style.animation = '';
                } else {
                    link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
                }
            });
        });

        // Close menu when a standard link is clicked
        // (We exclude the dropdown trigger so clicking "Works" doesn't close the menu immediately)
        links.forEach(link => {
            if (!link.classList.contains('dropdown')) {
                link.addEventListener('click', () => {
                    navLinks.classList.remove('active');
                    hamburger.classList.remove('active');
                    links.forEach(l => l.style.animation = '');
                });
            }
        });

        // Mobile Dropdown Logic (Tap "Works" to open submenu)
        if (dropdown && dropBtn) {
            dropBtn.addEventListener('click', (e) => {
                // If on mobile (screen smaller than 768px)
                if (window.innerWidth <= 768) {
                    e.preventDefault(); // Don't jump to anchor
                    dropdown.classList.toggle('active'); // CSS handles showing the sub-menu
                }
            });
        }
    }
});