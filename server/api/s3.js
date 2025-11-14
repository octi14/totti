const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const BUCKET =
  process.env.S3_BUCKET_NAME ||
  process.env.AWS_S3_BUCKET ||
  process.env.S3_BUCKET ||
  process.env.AWS_BUCKET ||
  '';
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2';
const SIGNED_URL_TTL_SECONDS = Number(process.env.S3_SIGNED_URL_TTL || 3600);

const audioExtensions = new Set(['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const metadataCandidates = ['metadata.json', 'album.json'];

let s3Client;

function getClient() {
  if (s3Client) {
    return s3Client;
  }
  s3Client = new S3Client({ region: REGION });
  return s3Client;
}

async function listTopLevelPrefixes() {
  const client = getClient();
  let continuationToken;
  const prefixes = [];

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Delimiter: '/',
      ContinuationToken: continuationToken,
    });
    const result = await client.send(command);
    if (Array.isArray(result.CommonPrefixes)) {
      result.CommonPrefixes.forEach((prefix) => {
        if (prefix && prefix.Prefix) {
          prefixes.push(prefix.Prefix);
        }
      });
    }
    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return prefixes;
}

async function listObjectsForPrefix(prefix) {
  const client = getClient();
  let continuationToken;
  const objects = [];

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const result = await client.send(command);
    if (Array.isArray(result.Contents)) {
      result.Contents.forEach((item) => {
        if (item && item.Key && item.Size > 0) {
          objects.push(item);
        }
      });
    }
    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

function normaliseName(prefix) {
  const withoutSlash = prefix.replace(/\/$/, '');
  const segments = withoutSlash.split('/');
  const raw = decodeURIComponent(segments[segments.length - 1] || withoutSlash);
  return raw.replace(/[_-]+/g, ' ').trim();
}

function extractYear(name) {
  const match = name.match(/(19|20)\d{2}/);
  if (match) {
    return match[0];
  }
  return '';
}

async function loadAlbumMetadata(prefix, objects) {
  const client = getClient();
  for (const candidate of metadataCandidates) {
    const key = `${prefix}${candidate}`;
    const exists = objects.some((obj) => obj.Key === key);
    if (!exists) {
      continue;
    }
    const response = await client.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
    const body = response.Body;
    let jsonString = '';
    if (Buffer.isBuffer(body)) {
      jsonString = body.toString('utf-8');
    } else if (typeof body?.transformToString === 'function') {
      jsonString = await body.transformToString('utf-8');
    } else {
      jsonString = await streamToString(body);
    }
    try {
      return JSON.parse(jsonString);
    } catch (_err) {
      return null;
    }
  }
  return null;
}

async function streamToString(stream) {
  if (!stream) {
    return '';
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

async function createSignedUrl(key) {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

async function buildAlbumFromPrefix(prefix, index) {
  const objects = await listObjectsForPrefix(prefix);
  if (!objects.length) {
    return null;
  }

  const metadata = await loadAlbumMetadata(prefix, objects);
  const audioObjects = objects.filter((obj) => audioExtensions.has(path.extname(obj.Key).toLowerCase()));
  const imageObject = objects.find((obj) => imageExtensions.has(path.extname(obj.Key).toLowerCase()));

  if (!audioObjects.length) {
    return null;
  }

  const normalisedName = metadata?.title || normaliseName(prefix);
  const year =
    (metadata?.year && String(metadata.year)) ||
    extractYear(normalisedName) ||
    (metadata?.releaseYear && String(metadata.releaseYear)) ||
    '';

  const primaryAudio = audioObjects.sort((a, b) => a.Key.localeCompare(b.Key))[0];
  const link = await createSignedUrl(primaryAudio.Key);

  let image = metadata?.art || metadata?.cover || '';
  if (!image && imageObject) {
    image = await createSignedUrl(imageObject.Key);
  }

  let tracks = metadata?.tracks?.length
    ? metadata.tracks
    : await Promise.all(
        audioObjects.map(async (obj, trackIndex) => ({
          id: trackIndex + 1,
          key: obj.Key,
          title: path.basename(obj.Key),
          url: await createSignedUrl(obj.Key),
        }))
      );

  const preparedTracks = await Promise.all(
    tracks.map(async (track, trackIndex) => {
      const keyCandidate =
        track.key ||
        track.Key ||
        track.path ||
        (audioObjects[trackIndex] && audioObjects[trackIndex].Key) ||
        '';
      const titleCandidate = track.title || track.nombre || (keyCandidate ? path.basename(keyCandidate) : `Pista ${trackIndex + 1}`);
      const urlCandidate =
        track.url ||
        track.link ||
        (keyCandidate ? await createSignedUrl(keyCandidate) : link);

      return {
        id: track.id || trackIndex + 1,
        key: keyCandidate,
        title: titleCandidate,
        url: urlCandidate,
        art: track.art || track.cover || '',
        duration: track.duration || null,
      };
    })
  );

  return {
    id: index + 1,
    nombre: normalisedName,
    año: year,
    image,
    link,
    prefix,
    tracks: preparedTracks,
  };
}

async function listAlbumsFromBucket() {
  const prefixes = await listTopLevelPrefixes();
  const albumResults = await Promise.all(prefixes.map((prefix, index) => buildAlbumFromPrefix(prefix, index)));
  return albumResults.filter(Boolean);
}

module.exports = async function s3AlbumsHandler(req, res, next) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Método no permitido' }));
    return;
  }

  if (!BUCKET) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Falta configurar S3_BUCKET_NAME en las variables de entorno.' }));
    return;
  }

  try {
    const albums = await listAlbumsFromBucket();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ albums }));
  } catch (error) {
    console.error('[S3] Error listando álbumes:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'No se pudo obtener la lista de álbumes.' }));
  }

  if (typeof next === 'function') {
    next();
  }
};

