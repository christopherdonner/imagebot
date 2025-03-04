console.log('index.js')

function expando(that, id){
    let key = that.classList;
    console.log(key);
    that.classList.length < 1 ? that.classList.add('big') : that.classList.remove('big');
}   

