import { useEffect, useState } from 'react';
import { extractPhotoPalette } from './data/photoPalette';

type PatternColor = { paletteId: string; color: string };
type Props = {
  baseColor: string;
  patternColors: PatternColor[];
  onBaseColorChange: (color: string) => void;
  onPatternColorChange: (paletteId: string, color: string) => void;
};

const presets = [
  { color: '#315F3A', name: '联调绿' },
  { color: '#0E6652', name: '墨竹青' },
  { color: '#75A78D', name: '青玉绿' },
];

export default function MaterialColorControls({ baseColor, patternColors, onBaseColorChange, onPatternColorChange }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoColors, setPhotoColors] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  function readPhoto(image: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 180 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return setPhotoError('无法读取照片颜色，请换一张图片。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const colors = extractPhotoPalette(context.getImageData(0, 0, canvas.width, canvas.height).data);
    setPhotoColors(colors);
    setPhotoError(colors.length ? '' : '照片中没有可提取的颜色。');
  }

  function samplePhoto(event: React.MouseEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    const bounds = image.getBoundingClientRect();
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const localX = event.clientX - bounds.left - (bounds.width - image.naturalWidth * scale) / 2;
    const localY = event.clientY - bounds.top - (bounds.height - image.naturalHeight * scale) / 2;
    if (localX < 0 || localY < 0 || localX >= image.naturalWidth * scale || localY >= image.naturalHeight * scale) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(image, Math.floor(localX / scale), Math.floor(localY / scale), 1, 1, 0, 0, 1, 1);
    const rgb = context.getImageData(0, 0, 1, 1).data;
    const hex = `#${Array.from(rgb.slice(0, 3), value => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    setPhotoColors(previous => [hex, ...previous.filter(color => color !== hex)].slice(0, 9));
  }

  function colorChoices(colors: { color: string; name?: string }[], source: string) {
    return <div className="extracted-colors" aria-label={source}>{colors.map(({ color, name }) => <div className="extracted-color" key={color}>
      <span className="extracted-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="extracted-label">{name ? `${name} · ` : ''}{color}</span>
      <div className="extracted-actions"><button type="button" onClick={() => onBaseColorChange(color)} aria-label={`${color} 用于底色`}>用于底色</button>
        {patternColors.map((entry, index) => <button type="button" key={entry.paletteId}
          onClick={() => onPatternColorChange(entry.paletteId, color)} aria-label={`${color} 用于图样色 ${index + 1}`}>
          用于图样色{patternColors.length > 1 ? ` ${index + 1}` : ''}</button>)}</div>
    </div>)}</div>;
  }

  return <section className="material-colors" aria-label="竹条配色">
    <h3>竹条配色</h3>
    <p>底色和每个图样色可分别设置。颜色仅用于屏幕预览，材料可用性待实物验证。</p>
    <div className="material-color-row">
      <label htmlFor="base-color">底色</label>
      <input id="base-color" type="color" value={baseColor} onChange={event => onBaseColorChange(event.target.value)} aria-label="自定义底色" />
      <output htmlFor="base-color">{baseColor.toUpperCase()}</output>
    </div>
    {patternColors.map((entry, index) => <div className="material-color-row" key={entry.paletteId}>
      <label htmlFor={`pattern-color-${index}`}>图样色 {index + 1}</label>
      <input id={`pattern-color-${index}`} type="color" value={entry.color}
        onChange={event => onPatternColorChange(entry.paletteId, event.target.value)} aria-label={`自定义图样色 ${index + 1}`} />
      <output htmlFor={`pattern-color-${index}`}>{entry.color.toUpperCase()}</output>
    </div>)}
    <h4>推荐色</h4>
    {colorChoices(presets, '推荐色')}
    <div className="material-photo">
      <strong>从实物照片提取颜色</strong>
      <p>选择照片后自动生成颜色选项；也可点击照片补取某个位置。选好颜色后再决定应用到底色或图样色。照片只在本机浏览器处理。</p>
      <label className="material-photo-upload">选择照片<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setPhotoError('请选择 PNG、JPEG 或 WebP 图片。');
        setPhotoColors([]); setPhotoError(''); setPhotoUrl(URL.createObjectURL(file));
      }} /></label>
      {photoError && <p role="alert">{photoError}</p>}
      {photoUrl && <><img src={photoUrl} alt="已选照片；点击照片可补取颜色" onLoad={event => readPhoto(event.currentTarget)}
        onError={() => { setPhotoColors([]); setPhotoError('照片无法打开，请换一张图片。'); }} onClick={samplePhoto} />
        {photoColors.length > 0 && <><h4>从照片提取的颜色</h4>{colorChoices(photoColors.map(color => ({ color })), '照片提取色')}</>}</>}
      <small>照片颜色会受光线、相机和屏幕影响；真实竹篾或染色是否可用仍需 B 组确认。</small>
    </div>
  </section>;
}
