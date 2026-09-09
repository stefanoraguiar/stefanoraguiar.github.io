document.addEventListener('DOMContentLoaded', () => {
    const slug = gallerySlug();
    const gate = document.getElementById('gallery-gate');
    const header = document.getElementById('gallery-header');
    const main = document.getElementById('gallery-main');
    const grid = document.getElementById('gallery-grid');
    const titleEl = document.getElementById('gallery-title');
    const emailForm = document.getElementById('email-form');
    const codeForm = document.getElementById('code-form');
    const errorEl = document.getElementById('gate-error');
    const gateCopy = document.getElementById('gate-copy');
    const emailInput = document.getElementById('gallery-email');
    const codeInput = document.getElementById('gallery-code');
    const sendBtn = document.getElementById('btn-send-code');
    const verifyBtn = document.getElementById('btn-verify');

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.close-lightbox');

    if (!slug) {
        showError('This gallery link is not valid.');
        gate.hidden = false;
        emailForm.hidden = true;
        return;
    }

    let pendingEmail = '';

    loadManifest()
        .then((data) => {
            if (data?.ok) renderGallery(data);
            else document.body.style.overflow = 'hidden';
        })
        .catch(() => {
            document.body.style.overflow = 'hidden';
        });

    emailForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setBusy(sendBtn, true);
        hideError();
        pendingEmail = emailInput.value.trim();
        try {
            const data = await postJSON('/api/gallery/request-code', {
                slug,
                email: pendingEmail,
            });
            if (!data.ok) {
                showError(data.error || 'Could not send the confirmation email.');
                return;
            }
            gateCopy.textContent = 'Check your inbox and enter the 6-digit confirmation number.';
            codeForm.hidden = false;
            codeInput.focus();
        } catch (error) {
            console.error(error);
            showError('Could not send the confirmation email.');
        } finally {
            setBusy(sendBtn, false);
        }
    });

    codeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setBusy(verifyBtn, true);
        hideError();
        try {
            const data = await postJSON('/api/gallery/verify-code', {
                slug,
                email: pendingEmail || emailInput.value.trim(),
                code: codeInput.value.trim(),
            });
            if (!data.ok) {
                showError(data.error || 'That confirmation number is not valid.');
                return;
            }
            const manifest = await loadManifest();
            if (!manifest?.ok) {
                showError('Signed in, but the gallery could not be loaded.');
                return;
            }
            renderGallery(manifest);
        } catch (error) {
            console.error(error);
            showError('Could not verify the confirmation number.');
        } finally {
            setBusy(verifyBtn, false);
        }
    });

    function renderGallery(data) {
        document.body.style.overflow = 'auto';
        gate.hidden = true;
        header.hidden = false;
        main.hidden = false;
        titleEl.textContent = data.title;
        document.title = `${data.title} | Stefano Aguiar`;
        grid.innerHTML = '';

        data.photos.forEach((photo) => {
            const figure = document.createElement('figure');
            figure.className = 'gallery-card';

            const trigger = document.createElement('a');
            trigger.href = photo.src;
            trigger.className = 'gallery-trigger';

            const img = document.createElement('img');
            img.src = photo.src;
            img.alt = data.title;
            img.loading = 'lazy';

            trigger.appendChild(img);

            const download = document.createElement('a');
            download.className = 'gallery-download';
            download.href = photo.download;
            download.textContent = 'Download';

            figure.appendChild(trigger);
            figure.appendChild(download);
            grid.appendChild(figure);
        });

        bindLightbox();
    }

    function bindLightbox() {
        const triggers = document.querySelectorAll('.gallery-trigger');
        triggers.forEach((trigger) => {
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                lightboxImg.src = trigger.getAttribute('href');
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
        lightbox.addEventListener('click', (event) => {
            if (event.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && lightbox.classList.contains('active')) {
                closeLightbox();
            }
        });
    }

    async function loadManifest() {
        const response = await fetch(`/api/gallery/manifest?slug=${encodeURIComponent(slug)}`, {
            credentials: 'include',
        });
        if (response.status === 401) return null;
        return response.json();
    }

    async function postJSON(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        });
        return response.json();
    }

    function showError(message) {
        errorEl.hidden = false;
        errorEl.textContent = message;
        gate.hidden = false;
    }

    function hideError() {
        errorEl.hidden = true;
        errorEl.textContent = '';
    }

    function setBusy(button, busy) {
        button.disabled = busy;
        button.textContent = busy ? 'Please wait…' : button.dataset.label || button.textContent;
    }

    sendBtn.dataset.label = 'Send confirmation';
    verifyBtn.dataset.label = 'Enter';
});

function gallerySlug() {
    const parts = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] === 'gallery' && parts[1]) return parts[1].toLowerCase();
    if (parts.length === 1 && isGalleryHost()) return parts[0].toLowerCase();
    return new URLSearchParams(window.location.search).get('slug');
}

function isGalleryHost() {
    const host = window.location.hostname;
    return host === 'gallery.stefanoaguiar.com' || host === 'localhost';
}
