const {
  S3Client,
  DeleteObjectCommand,
  CopyObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET =
  process.env.S3_BUCKET_NAME ||
  process.env.AWS_S3_BUCKET ||
  process.env.S3_BUCKET ||
  process.env.AWS_BUCKET ||
  '';
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2';
const UPLOAD_SIGNED_URL_TTL = Number(process.env.S3_UPLOAD_SIGNED_URL_TTL || 900);
const DOWNLOAD_SIGNED_URL_TTL = Number(process.env.S3_DOWNLOAD_SIGNED_URL_TTL || 3600);

let s3Client;

function getClient() {
  if (s3Client) {
    return s3Client;
  }
  s3Client = new S3Client({ region: REGION });
  return s3Client;
}

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function validateKey(key = '') {
  if (!key || typeof key !== 'string') {
    throw new Error('key es obligatorio');
  }
  if (key.includes('..')) {
    throw new Error('key inválido');
  }
  return key;
}

function formatCopySource(key) {
  return `${BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
}

async function ensureObjectExists(key) {
  const client = getClient();
  await client.send(
    new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

module.exports = async function s3ManageHandler(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Método no permitido' });
    return;
  }

  if (!BUCKET) {
    send(res, 500, { error: 'Falta configurar S3_BUCKET_NAME en las variables de entorno.' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    send(res, 400, { error: error.message });
    return;
  }

  const action = body?.action;
  const client = getClient();

  try {
    switch (action) {
      case 'createUploadUrl': {
        const key = validateKey(body.key);
        const contentType = body.contentType || 'application/octet-stream';
        const command = new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          ContentType: contentType,
        });
        const url = await getSignedUrl(client, command, { expiresIn: UPLOAD_SIGNED_URL_TTL });
        send(res, 200, { url, key, expiresIn: UPLOAD_SIGNED_URL_TTL });
        return;
      }
      case 'deleteObject': {
        const key = validateKey(body.key);
        await client.send(
          new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
          })
        );
        send(res, 200, { deleted: true, key });
        return;
      }
      case 'renameObject': {
        const sourceKey = validateKey(body.sourceKey);
        const targetKey = validateKey(body.targetKey);
        if (sourceKey === targetKey) {
          send(res, 200, { renamed: false, reason: 'source y target son iguales' });
          return;
        }
        await ensureObjectExists(sourceKey);
        await client.send(
          new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: formatCopySource(sourceKey),
            Key: targetKey,
          })
        );
        await client.send(
          new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: sourceKey,
          })
        );
        send(res, 200, { renamed: true, sourceKey, targetKey });
        return;
      }
      case 'createDownloadUrl': {
        const key = validateKey(body.key);
        await ensureObjectExists(key);
        const command = new GetObjectCommand({
          Bucket: BUCKET,
          Key: key,
        });
        const url = await getSignedUrl(client, command, { expiresIn: DOWNLOAD_SIGNED_URL_TTL });
        send(res, 200, { url, key, expiresIn: DOWNLOAD_SIGNED_URL_TTL });
        return;
      }
      case 'createFolder': {
        const folderName = body.folderName || '';
        if (!folderName || typeof folderName !== 'string') {
          send(res, 400, { error: 'folderName es obligatorio' });
          return;
        }
        // Sanitizar el nombre de la carpeta
        const sanitized = folderName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9-_]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .toLowerCase();
        if (!sanitized) {
          send(res, 400, { error: 'Nombre de carpeta inválido' });
          return;
        }
        // Crear un prefijo (carpeta) en S3 creando un objeto placeholder
        const folderKey = `${sanitized}/.gitkeep`;
        try {
          // Verificar si ya existe
          try {
            await client.send(
              new HeadObjectCommand({
                Bucket: BUCKET,
                Key: folderKey,
              })
            );
            send(res, 400, { error: 'La carpeta ya existe' });
            return;
          } catch (headError) {
            // Si no existe, continuar
          }
          // Crear el objeto placeholder para la carpeta
          await client.send(
            new PutObjectCommand({
              Bucket: BUCKET,
              Key: folderKey,
              ContentType: 'text/plain',
              Body: '',
            })
          );
          send(res, 200, { created: true, folderName: sanitized, prefix: `${sanitized}/` });
          return;
        } catch (error) {
          console.error('[S3] Error creando carpeta:', error);
          send(res, 500, { error: 'No se pudo crear la carpeta' });
          return;
        }
      }
      default:
        send(res, 400, { error: 'Acción no soportada' });
    }
  } catch (error) {
    console.error('[S3] Error en acción de gestión:', error);
    send(res, 500, { error: error.message || 'Error interno' });
  }
};


