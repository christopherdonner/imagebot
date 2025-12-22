
function view(that, id) {

    let viewer = document.querySelector('.viewer'),
        viewerImage = viewer.querySelector('.image');
    let o = 1;

    viewer.classList.remove('hidden');
    viewerImage.innerHTML = `<img src='${that.src}' onclick='shrinkAll()' class='enhanced-image'/>`

    let nextButton = viewer.querySelector('#next'),
        prevButton = viewer.querySelector('#prev');

    nextButton.addEventListener('click', function () {
        let viewerID = id;

        let nextImage = document.querySelector(`img[data-id='${parseInt(viewerID) + o}']`),
            nextImageSRC = nextImage.getAttribute('full');
        viewerImage.innerHTML = `<img src='${nextImageSRC}'/>`
        o++;
        if (parseInt(viewerID) + o > document.querySelectorAll('img').length) {
            viewerID = 1;
        }
    });

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