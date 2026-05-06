# imagebot
art gallery/css sandbox

create a subfolder of /public/ named /img/ and populate it with png or jpg files, server will build and serve webpage of those images.

sub-folers of /img/ will generate elemsnts in the header using the folder names with routes to pages populated with the contents of said folder.

takes a directory listing of /public/img, creates thumbnail files, and uses the resulting array of filenames to build a web page of img tags pointing to the files in the /public/img directory.
On hover, the SRC property for the IMG tag is set to the original, high quality image.

Instructions:
Clone repo
Browse to root. Run: npm install
cd public
mkdir img
Place images in the ./public/img/ directory
Run: npm start
browse to: localhost on the port specified 
