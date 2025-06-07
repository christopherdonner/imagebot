console.log('index.js')

function expando(that, id){
    let key = that.classList,
        newSRC;
    let firstHalfSRC = that.src.split('.').splice(0,that.src.split('.').length-3);
    let extension = that.src.split('.').splice((that.src.split('.').length)-1,that.src.split('.').length-3)[0];
    if(that.src.includes('thumb')){

        let newSRC = that.src.split('thumb.png')[0].slice(0,that.src.split('thumb.png')[0].length-1);
        that.src = newSRC;
    }
    console.log(that);
    console.log(key);

    if(that.classList.contains('big')){
        that.classList.remove('big');
    } else {
        that.classList.add('big')
    }
}   

