document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 0. AGE GATE LOGIC (Injects HTML automatically)
    // ==========================================
    const checkAge = () => {
        // If user has NOT verified yet
        if (!localStorage.getItem('ageVerified')) {
            
            // 1. Create the HTML for the overlay
            const ageGateHTML = `
                <div id="age-gate">
                    <div class="age-gate-content">
                        <h2>Restricted Access</h2>
                        <p>This website contains artistic nude photography and adult themes.<br>
                        Please verify that you are 18 years of age or older to enter.</p>
                        
                        <div class="age-gate-buttons">
                            <button id="btn-enter" class="btn-enter">I am 18+</button>
                            <button id="btn-exit" class="btn-exit">Exit</button>
                        </div>
                    </div>
                </div>
            `;

            // 2. Inject it into the body
            document.body.insertAdjacentHTML('beforeend', ageGateHTML);
            document.body.style.overflow = 'hidden'; // Stop scrolling

            // 3. Add Button Logic
            const btnEnter = document.getElementById('btn-enter');
            const btnExit = document.getElementById('btn-exit');
            const ageGate = document.getElementById('age-gate');

            // ENTER: Save cookie and remove overlay
            btnEnter.addEventListener('click', () => {
                localStorage.setItem('ageVerified', 'true');
                ageGate.style.opacity = '0';
                setTimeout(() => {
                    ageGate.remove();
                    document.body.style.overflow = 'auto'; // Re-enable scroll
                }, 500);
            });

            // EXIT: Redirect to Google
            btnExit.addEventListener('click', () => {
                window.location.href = "https://www.google.com";
            });
        }
    };

    // Run the check immediately
    checkAge();


    // ==========================================
    // 1. LIGHTBOX LOGIC (Gallery Zoom)
    // ==========================================
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.close-lightbox');
    const triggers = document.querySelectorAll('.gallery-trigger');

    if (lightbox) {
        triggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const fullSizeSrc = trigger.getAttribute('href');
                lightboxImg.src = fullSizeSrc;
                lightbox.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        });

        const closeLightbox = () => {
            lightbox.classList.remove('active');
            document.body.style.overflow = 'auto';
            setTimeout(() => { lightboxImg.src = ''; }, 300);
        };

        if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
        
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                closeLightbox();
            }
        });
    }


    // ==========================================
    // 2. MOBILE MENU LOGIC
    // ==========================================
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const links = document.querySelectorAll('.nav-links li');
    const dropdown = document.querySelector('.dropdown');
    const dropBtn = document.querySelector('.dropbtn');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');

            links.forEach((link, index) => {
                if (link.style.animation) {
                    link.style.animation = '';
                } else {
                    link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
                }
            });
        });

        links.forEach(link => {
            if (!link.classList.contains('dropdown')) {
                link.addEventListener('click', () => {
                    navLinks.classList.remove('active');
                    hamburger.classList.remove('active');
                    links.forEach(l => l.style.animation = '');
                });
            }
        });

        if (dropdown && dropBtn) {
            dropBtn.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    dropdown.classList.toggle('active');
                }
            });
        }
    }
});