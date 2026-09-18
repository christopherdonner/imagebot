// client side javascript

function view(that, id) {

    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image');
        captionElement = document.querySelector('#caption'),
        caption = that.getAttribute('title');
        viewer.id = id;

    viewer.classList.remove('hidden');
    viewerImage.innerHTML = `<a href='${that.src}'><img src='${that.src}'  class='enhanced-image'/></a>`;
    
    viewer.focus();
    captionElement.innerHTML = caption;
}

function nextImage(that) {
    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image'),
        captionElement = document.querySelector('#caption'),
        caption = that.getAttribute('title'),
        currentID = viewer.id,
        nextID = parseInt(currentID) - 1,
        nextImage = document.querySelector(`img[data-id='${nextID}']`);
        nextImageSRC = nextImage.getAttribute('full') || nextImage.getAttribute('src');
    viewerImage.innerHTML = `<a href='${nextImageSRC}'><img src='${nextImageSRC}'/></a>`
    viewer.id = nextID;
    viewerImage.parentElement.setAttribute('href', nextImageSRC);
    captionElement.textContent = nextImage.getAttribute('title') || '';
}

function previous(that) {
    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image'),
        captionElement = document.querySelector('#caption'),
        currentID = viewer.id,
        prevID = parseInt(currentID) + 1,
        prevImage = document.querySelector(`img[data-id='${prevID}']`),
        prevImageSRC = prevImage.getAttribute('full') || prevImage.getAttribute('src');
    viewerImage.innerHTML = `<a href='${prevImageSRC}'><img src='${prevImageSRC}'/></a>`;
    captionElement.textContent = prevImage.getAttribute('title') || '';
    viewer.id = prevID;
}

function enhance(that) {
    console.log('ehnahce')
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
    console.log(e.key);
    if (e.key === 'Escape') {
        closeViewer();
    }
    if (e.key === 'ArrowRight') {
        if (viewer.classList.contains('hidden')) {
            console.log('nextSMall')
        } else {

            nextImage(that);
        }
    }
    if (e.key === 'ArrowLeft') {
        previous(that);
    }
    if (e.key == 'Enter') {
        console.log('enter')
        viewerImage.querySelector('a').click();
    }
}