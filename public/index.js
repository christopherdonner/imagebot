// client side javascript

function view(that, id) {

    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image');
    viewer.id = id,
    caption = that.getAttribute('title');

    viewer.classList.remove('hidden');
    viewerImage.innerHTML = `<a href='${that.src}'><img src='${that.src}'  class='enhanced-image'/></a>`
    document.querySelector('#caption').textContent = caption;

    let nextButton = viewer.querySelector('#next'),
        prevButton = viewer.querySelector('#last');
    viewer.focus();
}

function nextImage() {
    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image'),
        captionElement = document.querySelector('#caption'),
        currentID = viewer.id,
        nextID = parseInt(currentID) - 1; // because I'm doing this backwards, has to be reversed ()
    let nextImage = document.querySelector(`img[data-id='${nextID}']`),
        nextImageSRC = nextImage.getAttribute('full');
    viewerImage.innerHTML = `<a href='${nextImageSRC}'><img src='${nextImageSRC}'/></a>`
    captionElement.textContent = nextImage.getAttribute('title') || '';
    viewer.id = nextID;
    console.log('next')
    viewerImage.parentElement.setAttribute('href', nextImageSRC);
}


function previous() {
    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image'),
        captionElement = document.querySelector('#caption'),
        currentID = viewer.id
    prevID = parseInt(currentID) + 1;
    let prevImage = document.querySelector(`img[data-id='${prevID}']`),
        prevImageSRC = prevImage.getAttribute('full');
    viewerImage.innerHTML = `<a href='${prevImageSRC}'><img src='${prevImageSRC}'/></a>`
    captionElement.textContent = prevImage.getAttribute('title') || '';
    viewer.id = prevID;
    console.log('previous')
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

            nextImage();
        }
    }
    if (e.key === 'ArrowLeft') {
        previous();
    }
    if (e.key == 'Enter') {
        console.log('enter')
        viewerImage.querySelector('a').click();
    }
}