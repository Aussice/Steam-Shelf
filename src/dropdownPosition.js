// Fixed portal coordinates keep the library menus outside the WebGL stage's
// clipping/stacking context and inside the visible window.
export function dropdownPosition(rect,viewportWidth,viewportHeight,count,preferredWidth=220) {
  const margin=8,gap=6;
  const width=Math.min(preferredWidth,Math.max(1,viewportWidth-margin*2));
  const maxHeight=Math.min(count*36+12,Math.max(1,viewportHeight-margin*2));
  const left=Math.max(margin,Math.min(rect.right-width,viewportWidth-margin-width));
  const below=rect.bottom+gap,above=rect.top-gap-maxHeight;
  const preferredTop=below+maxHeight<=viewportHeight-margin?below:above>=margin?above:below;
  const top=Math.max(margin,Math.min(preferredTop,viewportHeight-margin-maxHeight));
  return {left,top,width,maxHeight};
}
