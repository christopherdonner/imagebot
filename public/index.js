
function view(that, id) {

    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image');
        viewer.id = id;

    viewer.classList.remove('hidden');
    viewerImage.innerHTML = `<img src='${that.src}' onclick='shrinkAll()' class='enhanced-image'/>`

    let nextButton = viewer.querySelector('#next'),
        prevButton = viewer.querySelector('#last');

        let viewerID = id;
    nextButton.addEventListener('click', function () {
nextImage();

    });
    prevButton.addEventListener('click', function () {
        previous();
        // let prevImage = document.querySelector(`img[data-id='${parseInt(viewerID) - o}']`),
        //     prevImageSRC = prevImage.getAttribute('full');
        // viewerImage.innerHTML = `<img src='${prevImageSRC}'/>`
        // o++;
    });
}

function nextImage(){
   let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image'),
        currentID = viewer.id,
        nextID = parseInt(currentID) + 1;
    let nextImage = document.querySelector(`img[data-id='${nextID}']`),
        nextImageSRC = nextImage.getAttribute('full');
    viewerImage.innerHTML = `<img src='${nextImageSRC}'/>`
    viewer.id = nextID;
    console.log('next' )
}


function previous(){
    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image'),
        currentID = viewer.id
        prevID = parseInt(currentID) - 1;
    let prevImage = document.querySelector(`img[data-id='${prevID}']`),
        prevImageSRC = prevImage.getAttribute('full');
    viewerImage.innerHTML = `<img src='${prevImageSRC}'/>`
    viewer.id = prevID;
    console.log('previous' )
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