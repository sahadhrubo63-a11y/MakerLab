// ১. Fabric.js দিয়ে ক্যানভাস ইনিশিয়ালাইজ করা
const canvas = new fabric.Canvas('pixelCanvas', {
    backgroundColor: '#ffffff' // ক্যানভাসের ডিফল্ট ব্যাকগ্রাউন্ড সাদা
});

// ২. "Add Text" বাটনে ক্লিক করলে টেক্সট যোগ করার লজিক
document.getElementById('addTextBtn').addEventListener('click', () => {
    const newText = new fabric.IText('New Text', {
        left: 150,
        top: 200,
        fontFamily: 'sans-serif',
        fill: '#000000', // ডিফল্ট কালো রঙ
        fontSize: 40,
        borderColor: '#22d3ee', // পিক্সেলল্যাবের মতো সিলেক্ট করলে নীল বর্ডার দেখাবে
        cornerColor: '#22d3ee',
        cornerSize: 10,
        transparentCorners: false
    });
    
    canvas.add(newText);
    canvas.setActiveObject(newText); // টেক্সট তৈরি হয়েই যেন সিলেক্ট হয়ে যায়
    canvas.renderAll();
});

// ৩. "Save Image" বাটন লজিক (ডিজাইন ডাউনলোড করার জন্য)
document.getElementById('saveBtn').addEventListener('click', () => {
    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1.0
    });
    const link = document.createElement('a');
    link.download = 'pixellab-design.png';
    link.href = dataURL;
    link.click();
});
