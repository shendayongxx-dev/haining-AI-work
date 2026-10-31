import { useEffect, useState } from 'react';

type ColorTarget = 'base' | 'pattern';

type Props = {
  baseColor: string;
  patternColor: string;
  onBaseColorChange: (color: string) => void;
  onPatternColorChange: (color: string) => void;
};

const previewColors = [
  { color: '#315F3A', name: '联调绿' },
  { color: '#0E6652', name: '墨竹青示意' },
  { color: '#75A78D', name: '青玉绿示意' },
];

export default function MaterialColorControls({ baseColor, patternColor, onBaseColorChange, onPatternColorChange }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [sampleTarget, setSampleTarget] = useState<ColorTarget>('pattern');
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  function samplePhoto(event: React.MouseEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    const bounds = image.getBoundingClientRect();
    if (!image.naturalWidth || !image.naturalHeight || !bounds.width || !bounds.height) return;
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const renderedWidth = image.naturalWidth * scale;
    const renderedHeight = image.naturalHeight * scale;
    const localX = event.clientX - bounds.left - (bounds.width - renderedWidth) / 2;
    const localY = event.clientY - bounds.top - (bounds.height - renderedHeight) / 2;
    if (localX < 0 || localY < 0 || localX >= renderedWidth || localY >= renderedHeight) return;
    const x = Math.min(image.naturalWidth - 1, Math.floor(localX / scale));
    const y = Math.min(image.naturalHeight - 1, Math.floor(localY / scale));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(image, x, y, 1, 1, 0, 0, 1, 1);
    const rgb = context.getImageData(0, 0, 1, 1).data;
    const hex = `#${Array.from(rgb.slice(0, 3), value => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    if (sampleTarget === 'base') onBaseColorChange(hex);
    else onPatternColorChange(hex);
  }

  return <section className="material-colors" aria-label="竹条配色">
    <h3>竹条配色</h3>
    <p>推荐组合：竹色底纹＋联调绿图样。下列颜色仅供屏幕预览，材料可用性待实物验证。</p>
    <div className="material-color-row">
      <label htmlFor="base-color">底色／经向竹条</label>
      <input id="base-color" type="color" value={baseColor} onChange={event => onBaseColorChange(event.target.value)} aria-label="自定义底色" />
      <output htmlFor="base-color">{baseColor.toUpperCase()}</output>
    </div>
    <div className="material-color-row">
      <label htmlFor="pattern-color">图样色／纬向竹条</label>
      <input id="pattern-color" type="color" value={patternColor} onChange={event => onPatternColorChange(event.target.value)} aria-label="自定义图样色" />
      <output htmlFor="pattern-color">{patternColor.toUpperCase()}</output>
    </div>
    <div className="material-color-presets" aria-label="示意配色">
      {previewColors.map(item => <button key={item.color} type="button" className={patternColor.toUpperCase() === item.color ? 'active' : ''}
        style={{ backgroundColor: item.color }} title={item.name} aria-label={`图样色：${item.name}`} aria-pressed={patternColor.toUpperCase() === item.color}
        onClick={() => onPatternColorChange(item.color)} />)}
    </div>
    <div className="material-photo">
      <strong>从实物照片取色</strong>
      <p>选择自己的竹篾实物照片，点击照片上的颜色。照片仅在本机浏览器中处理，不上传。</p>
      <label className="material-photo-upload">选择照片<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
        const file = event.target.files?.[0];
        if (file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) setPhotoUrl(URL.createObjectURL(file));
      }} /></label>
      {photoUrl && <><div className="material-photo-target" aria-label="取色应用到">
        <button type="button" aria-pressed={sampleTarget === 'base'} onClick={() => setSampleTarget('base')}>取作底色</button>
        <button type="button" aria-pressed={sampleTarget === 'pattern'} onClick={() => setSampleTarget('pattern')}>取作图样色</button>
      </div><img src={photoUrl} alt="已选择的竹篾实物照片；点击图片取色" onClick={samplePhoto} /></>}
      <small>照片颜色会受光线、相机和屏幕影响；真实竹篾或染色是否可用仍需 B 组确认。</small>
    </div>
  </section>;
}
