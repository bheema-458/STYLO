
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const assetsFolder = path.resolve("src/assets");

const supportedFormats = [".png", ".jpg", ".jpeg"];

async function convertFolder(folder) {
  const items = await fs.readdir(folder, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(folder, item.name);

    if (item.isDirectory()) {
      await convertFolder(fullPath);
      continue;
    }

    const extension = path.extname(item.name).toLowerCase();

    if (!supportedFormats.includes(extension)) {
      continue;
    }

    const outputPath =
      fullPath.slice(0, -extension.length) + ".webp";

    try {
      await sharp(fullPath)
        .webp({ quality: 82, effort: 6 })
        .toFile(outputPath);

      console.log(`Converted: ${item.name}`);
    } catch (error) {
      console.error(`Failed: ${item.name}`, error.message);
    }
  }
}

convertFolder(assetsFolder)
  .then(() => console.log("All image conversions completed!"))
  .catch((error) => console.error(error));
