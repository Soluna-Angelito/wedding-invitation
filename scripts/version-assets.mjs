import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const indexPath = path.join(rootDir, "index.html");
const hashLength = 16;

if (!fs.existsSync(indexPath)) {
  console.error(`index.html not found at ${indexPath}`);
  process.exit(1);
}

const source = fs.readFileSync(indexPath, "utf8");
const assetUrlPattern =
  /(?<url>(?:\.\/)?assets\/[^"')\s?#]+(?:\?[^"')\s#]*)?(?:#[^"')\s]*)?)/g;

const hashByAssetPath = new Map();
const missingAssets = new Set();

function removeVersionParam(searchParams) {
  searchParams.delete("v");
}

function versionUrl(rawUrl) {
  const [urlWithoutHash, hashFragment = ""] = rawUrl.split("#", 2);
  const [rawAssetPath, rawQuery = ""] = urlWithoutHash.split("?", 2);
  const normalizedAssetPath = rawAssetPath.startsWith("./")
    ? rawAssetPath.slice(2)
    : rawAssetPath;

  if (!hashByAssetPath.has(normalizedAssetPath)) {
    const absoluteAssetPath = path.join(
      rootDir,
      normalizedAssetPath.split("/").join(path.sep),
    );

    if (!fs.existsSync(absoluteAssetPath)) {
      missingAssets.add(normalizedAssetPath);
      return rawUrl;
    }

    const fileBuffer = fs.readFileSync(absoluteAssetPath);
    const hash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex")
      .slice(0, hashLength);
    hashByAssetPath.set(normalizedAssetPath, hash);
  }

  const params = new URLSearchParams(rawQuery);
  removeVersionParam(params);
  params.append("v", hashByAssetPath.get(normalizedAssetPath));

  const queryString = params.toString();
  const withQuery = `${rawAssetPath}?${queryString}`;
  return hashFragment ? `${withQuery}#${hashFragment}` : withQuery;
}

const updated = source.replace(assetUrlPattern, (...args) => {
  const match = args[0];
  const groups = args.at(-1);
  const rawUrl = groups?.url ?? match;
  return versionUrl(rawUrl);
});

if (missingAssets.size > 0) {
  console.warn(
    "Skipped missing assets:",
    Array.from(missingAssets).sort().join(", "),
  );
}

if (updated !== source) {
  fs.writeFileSync(indexPath, updated, "utf8");
  console.log("Updated version tags in index.html");
} else {
  console.log("No version tag updates were needed in index.html");
}

console.log("Versioned assets:");
for (const [assetPath, hash] of Array.from(hashByAssetPath.entries()).sort()) {
  console.log(`- ${assetPath} => ${hash}`);
}
