import fs from 'fs';
const D = 'C:/Users/ajons/AppData/Local/Temp/claude/C--Users-ajons/86065028-648c-4f69-a382-139c4ddc0563/scratchpad/img2/';
// [file, y0 fraction, y1 fraction]
const crops = { 'stg44.jpg': [0, 0.5], 'garand.jpg': [0, 0.5], 'enfield.jpg': [0, 0.5], 'k98k.png': [0, 0.5], 'supp762.jpg': [0.5, 1] };
export default async (b) => {
  await b.goto('about:blank');
  for (const [f, [a, c]] of Object.entries(crops)) {
    const data = await b.eval(`new Promise(res => { const im = new Image(); im.onload = () => { const h = im.height * (${c} - ${a}), cv = document.createElement('canvas'); cv.width = im.width; cv.height = Math.round(h);
      const g = cv.getContext('2d'); g.drawImage(im, 0, im.height * ${a}, im.width, h, 0, 0, im.width, h); res(cv.toDataURL('${f.endsWith('png') ? 'image/png' : 'image/jpeg'}', 0.9)); }; im.src = '${'data:image/' + (f.endsWith('png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(D + f).toString('base64')}'; })`);
    fs.writeFileSync(D + f, Buffer.from(data.split(',')[1], 'base64')); console.log(f, data.length);
  }
};
