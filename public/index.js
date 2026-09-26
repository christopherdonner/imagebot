// client side javascript

function view(that, id) {
    showViewerImage(that, id);
    document.querySelector('.viewer').classList.remove('hidden');
    document.querySelector('.viewer').focus();
}

function showViewerImage(sourceImage, id) {
    const viewer = document.querySelector('.viewer');
    const viewerImage = viewer.querySelector('.image');
    const captionElement = document.querySelector('#caption');
    const artworkPath = (sourceImage.getAttribute('full') || sourceImage.getAttribute('src')).replace(/^\/+/, '');
    const artworkUrl = `/${artworkPath.split('/').map(encodeURIComponent).join('/')}`;
    const link = document.createElement('a');
    const image = document.createElement('img');

    link.href = artworkUrl;
    image.src = artworkUrl;
    image.alt = sourceImage.alt || 'Drawing';
    image.className = 'enhanced-image';
    link.appendChild(image);
    viewerImage.replaceChildren(link);
    captionElement.textContent = sourceImage.getAttribute('title') || '';
    viewer.dataset.artworkPath = artworkPath;
    viewer.dataset.artworkName = sourceImage.alt || 'Drawing';
    viewer.id = id;

    if (typeof updateViewerPrice === 'function') updateViewerPrice();
}

function nextImage() {
    const nextID = parseInt(document.querySelector('.viewer').id, 10) + 1;
    const nextArtwork = document.querySelector(`img[data-id='${nextID}']`);
    if (nextArtwork) showViewerImage(nextArtwork, nextID);
}


function previous() {
    const previousID = parseInt(document.querySelector('.viewer').id, 10) - 1;
    const previousArtwork = document.querySelector(`img[data-id='${previousID}']`);
    if (previousArtwork) showViewerImage(previousArtwork, previousID);
}


function enhance(that) {
    let key = that.classList,
        newSRC;
    let firstHalfSRC = that.src.split('.').splice(0, that.src.split('.').length - 3);
    let extension = that.src.split('.').splice((that.src.split('.').length) - 1, that.src.split('.').length - 3)[0];
    if (that.src.includes('thumb')) {
        let newSRC = that.src.split('thumb.png')[0].slice(0, that.src.split('thumb.png')[0].length - 1);
        that.src = newSRC;
    }
}

function closeViewer(that) {
    let viewer = document.querySelector('.viewer');
    viewer.classList.add('hidden');
    viewer.querySelector('.image').innerHTML = '';
}

function keyboardhandler(e, that) {
    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image');
    if (e.key === 'Escape') {
        closeViewer();
    }
    if (e.key === 'ArrowRight') {
        if (!viewer.classList.contains('hidden')) nextImage();
    }
    if (e.key === 'ArrowLeft' && !viewer.classList.contains('hidden')) {
        previous();
    }
    if (e.key === 'Enter' && e.target === document.body) {
        viewerImage.querySelector('a')?.click();
    }
}