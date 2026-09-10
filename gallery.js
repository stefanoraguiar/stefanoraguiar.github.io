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
    const downloadBar = document.getElementById('gallery-download-bar');
    const downloadAllBtn = document.getElementById('btn-download-all');
    const zipModal = document.getElementById('gallery-zip-modal');
    const zipCopy = document.getElementById('zip-modal-copy');
    const zipCancel = document.getElementById('btn-zip-cancel');
    const zipConfirm = document.getElementById('btn-zip-confirm');

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.close-lightbox');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    const canShare = typeof navigator.share === 'function';
    const tabKey = `gallery_open_${slug || ''}`;
    let zipDownload = '';
    let lightboxBound = false;
    let galleryPhotos = [];
    let lightboxIndex = 0;

    if (!slug) {
        showError('This gallery link is not valid.');
        gate.hidden = false;
        emailForm.hidden = true;
        return;
    }

    let pendingEmail = '';

    startSession();

    async function startSession() {
        if (!sessionStorage.getItem(tabKey)) {
            await fetch('/api/gallery/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
            document.body.style.overflow = 'hidden';
            return;
        }
        try {
            const data = await loadManifest();
            if (data?.ok) renderGallery(data);
            else document.body.style.overflow = 'hidden';
        } catch (error) {
            document.body.style.overflow = 'hidden';
        }
    }

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
            sessionStorage.setItem(tabKey, '1');
            renderGallery(manifest);
        } catch (error) {
            console.error(error);
            showError('Could not verify the confirmation number.');
        } finally {
            setBusy(verifyBtn, false);
        }
    });

    downloadAllBtn.addEventListener('click', () => {
        if (!zipDownload) return;
        zipModal.hidden = false;
        document.body.style.overflow = 'hidden';
    });

    zipCancel.addEventListener('click', closeZipModal);
    zipModal.addEventListener('click', (event) => {
        if (event.target === zipModal) closeZipModal();
    });
    zipConfirm.addEventListener('click', () => {
        if (!zipDownload) return;
        window.location.href = zipDownload;
        closeZipModal();
    });

    function renderGallery(data) {
        document.body.style.overflow = 'auto';
        gate.hidden = true;
        header.hidden = false;
        main.hidden = false;
        titleEl.textContent = data.title;
        document.title = `${data.title} | Stefano Aguiar`;
        grid.innerHTML = '';

        const photos = [...(data.photos || [])].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                numeric: true,
                sensitivity: 'base',
            })
        );

        galleryPhotos = photos;

        photos.forEach((photo, index) => {
            const figure = document.createElement('figure');
            figure.className = 'gallery-card';

            const media = document.createElement('div');
            media.className = 'gallery-media';

            const trigger = document.createElement('a');
            trigger.href = photo.src;
            trigger.className = 'gallery-trigger';
            trigger.dataset.index = String(index);

            const img = document.createElement('img');
            img.src = photo.src;
            img.alt = data.title;
            img.loading = 'lazy';

            trigger.appendChild(img);

            const actions = document.createElement('div');
            actions.className = 'gallery-card-actions';
            actions.addEventListener('click', (event) => event.stopPropagation());

            const download = document.createElement('a');
            download.className = 'gallery-icon-btn';
            download.href = photo.download;
            download.download = photo.name;
            download.setAttribute('aria-label', 'Download photo');
            download.title = 'Download';
            download.innerHTML = downloadIcon();
            download.addEventListener('click', (event) => event.stopPropagation());

            actions.appendChild(download);

            if (canShare) {
                const share = document.createElement('button');
                share.type = 'button';
                share.className = 'gallery-icon-btn';
                share.setAttribute('aria-label', 'Share photo');
                share.title = 'Share';
                share.innerHTML = shareIcon();
                share.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    sharePhoto(photo, data.title);
                });
                actions.appendChild(share);
            }

            media.appendChild(trigger);
            media.appendChild(actions);
            figure.appendChild(media);
            grid.appendChild(figure);
        });

        if (data.zip?.download) {
            zipDownload = data.zip.download;
            const count = data.zip.count || photos.length;
            downloadAllBtn.textContent = `Download all · ${data.zip.sizeLabel}`;
            zipCopy.innerHTML = zipModalCopy(data.zip.sizeLabel, count);
            downloadBar.hidden = false;
            document.body.classList.add('gallery-has-download-bar');
        } else {
            zipDownload = '';
            downloadBar.hidden = true;
            document.body.classList.remove('gallery-has-download-bar');
        }

        bindLightbox();
    }

    function bindLightbox() {
        const triggers = document.querySelectorAll('.gallery-trigger');
        triggers.forEach((trigger) => {
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                openLightbox(Number(trigger.dataset.index) || 0);
            });
        });

        if (lightboxBound) return;
        lightboxBound = true;

        if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
        if (lightboxPrev) lightboxPrev.addEventListener('click', (event) => {
            event.stopPropagation();
            stepLightbox(-1);
        });
        if (lightboxNext) lightboxNext.addEventListener('click', (event) => {
            event.stopPropagation();
            stepLightbox(1);
        });
        lightbox.addEventListener('click', (event) => {
            if (event.target === lightbox) closeLightbox();
        });
        lightboxImg.addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('keydown', (event) => {
            if (!zipModal.hidden) {
                if (event.key === 'Escape') closeZipModal();
                return;
            }
            if (!lightbox.classList.contains('active')) return;
            if (event.key === 'Escape') closeLightbox();
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                stepLightbox(-1);
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                stepLightbox(1);
            }
        });
    }

    function openLightbox(index) {
        if (!galleryPhotos.length) return;
        lightboxIndex = (index + galleryPhotos.length) % galleryPhotos.length;
        lightboxImg.src = galleryPhotos[lightboxIndex].src;
        lightboxImg.alt = galleryPhotos[lightboxIndex].name || titleEl.textContent;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function stepLightbox(delta) {
        if (!lightbox.classList.contains('active') || !galleryPhotos.length) return;
        openLightbox(lightboxIndex + delta);
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        if (zipModal.hidden) document.body.style.overflow = 'auto';
        setTimeout(() => { lightboxImg.src = ''; }, 300);
    }

    function closeZipModal() {
        zipModal.hidden = true;
        if (!lightbox.classList.contains('active')) document.body.style.overflow = 'auto';
    }

    async function sharePhoto(photo, title) {
        try {
            const response = await fetch(photo.src, { credentials: 'include' });
            if (!response.ok) throw new Error('Could not load photo');
            const blob = await response.blob();
            const file = new File([blob], photo.name, { type: blob.type || 'image/webp' });
            const payload = { files: [file], title, text: title };
            if (navigator.canShare && !navigator.canShare(payload)) {
                await navigator.share({ title, text: title, url: window.location.href });
                return;
            }
            await navigator.share(payload);
        } catch (error) {
            if (error?.name === 'AbortError') return;
            console.error(error);
        }
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

function zipModalCopy(sizeLabel, count) {
    return `
        <span>This is a zip file of about <strong>${sizeLabel}</strong> (${count} photos). On a phone it will save to Files or Downloads. You will need to unzip it yourself — the photos will not appear in your camera roll automatically.</span>
        <span lang="pt">Este ficheiro zip tem cerca de <strong>${sizeLabel}</strong> (${count} fotos). No telemóvel fica em Ficheiros ou Transferências. Tens de o descompactar tu — as fotos não entram sozinhas na galeria do telemóvel.</span>
    `;
}

function downloadIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>';
}

function shareIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14V3"/><path d="m8 7 4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
}

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
