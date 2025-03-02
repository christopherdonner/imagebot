console.log('index.js')

function expando(that, id){
    let image = document.createElement('img');
    that.appendChild(image);
    console.log(that);
    console.log(id);
    that.height=800;

}