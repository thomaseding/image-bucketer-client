export function registerMagnify() {
  const mainImage = document.getElementById("subject-image") as HTMLImageElement;
  if (!mainImage) throw new Error("Main image not found");

  const magnifierGlass = document.getElementById("magnifier-glass")!;
  if (!magnifierGlass) throw new Error("Magnifier glass not found");

  const zoomFactor = 3.0;
  const glassSize = 600; // matches CSS

  mainImage.addEventListener("mousemove", (e: MouseEvent) => {
    const imageRect = mainImage.getBoundingClientRect();
    const offsetX = e.clientX - imageRect.left;
    const offsetY = e.clientY - imageRect.top;

    const scaleX = mainImage.clientWidth / mainImage.naturalWidth;
    const scaleY = mainImage.clientHeight / mainImage.naturalHeight;

    const bgPosX = (offsetX / scaleX - glassSize / (2 * zoomFactor)) * zoomFactor;
    const bgPosY = (offsetY / scaleY - glassSize / (2 * zoomFactor)) * zoomFactor;

    const clampedBgPosX = Math.max(0, bgPosX);
    const clampedBgPosY = Math.max(0, bgPosY);

    const magLeft = e.clientX - glassSize / 2;
    const magTop = e.clientY - glassSize / 2;

    const bgWidth = mainImage.clientWidth * zoomFactor;
    const bgHeight = mainImage.clientHeight * zoomFactor;

    const distanceFromTop = e.clientY - glassSize / 2;

    const effectiveScrollY = Math.max(0, window.scrollY - distanceFromTop);

    magnifierGlass.style.left = `${magLeft}px`;
    magnifierGlass.style.top = `${magTop + effectiveScrollY}px`;

    magnifierGlass.style.backgroundImage = `url("${mainImage.src}")`;
    magnifierGlass.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
    magnifierGlass.style.backgroundPosition = `-${clampedBgPosX}px -${clampedBgPosY + window.scrollY}px`;
  });

  mainImage.addEventListener("mouseenter", () => {
    magnifierGlass.style.display = "block";
  });
  mainImage.addEventListener("mouseleave", () => {
    magnifierGlass.style.display = "none";
  });
}
