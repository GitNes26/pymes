<?php
declare(strict_types=1);

/**
 * Microservicio de imágenes — punto de entrada.
 *
 *   GET    /health                          Estado del servicio (público)
 *   GET    /i/{proyecto}/{archivo}?w=&fmt=  Sirve la imagen (público, con caché)
 *   POST   /v1/images                       Sube 1 o varias imágenes         (llave)
 *   GET    /v1/images?project=&page=        Lista imágenes de un proyecto    (llave)
 *   GET    /v1/images/{proyecto}/{archivo}  Datos de una imagen              (llave)
 *   DELETE /v1/images/{proyecto}/{archivo}  Borra una imagen y sus variantes (llave)
 */

$root = dirname(__DIR__);
require $root . '/src/Http.php';
require $root . '/src/Images.php';

Http::$requestId = bin2hex(random_bytes(8));

if (!is_file($root . '/config.php')) {
    Http::json(500, ['ok' => false, 'error' => ['code' => 'NOT_CONFIGURED', 'message' => 'Falta config.php. Copia config.example.php como config.php y configúralo.']]);
}
if (function_exists('opcache_invalidate')) @opcache_invalidate($root . '/config.php', true); // Hostinger cachea PHP: así los cambios a config.php aplican al momento
$cfg = require $root . '/config.php';
$logFile = rtrim($cfg['storage_path'], '/') . '/logs/app.log';

function logLine(string $file, string $level, string $msg): void
{
    $dir = dirname($file);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents($file, sprintf("[%s] %s %s %s %s %s\n", gmdate('c'), $level, Http::$requestId, Http::method(), $_SERVER['REQUEST_URI'] ?? '', $msg), FILE_APPEND | LOCK_EX);
}

// Cualquier error no previsto se responde en JSON sin exponer detalles internos.
set_exception_handler(function (Throwable $e) use ($cfg, $logFile) {
    if ($e instanceof ApiError) Http::error($e);
    logLine($logFile, 'ERROR', get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $details = !empty($cfg['debug']) ? ['exception' => get_class($e), 'detail' => $e->getMessage()] : [];
    Http::error(new ApiError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno. Intenta de nuevo; si persiste, reporta el request_id.', $details));
});
set_error_handler(function (int $no, string $str, string $file, int $line) {
    if (!(error_reporting() & $no)) return false;
    throw new ErrorException($str, 0, $no, $file, $line);
});

Http::cors($cfg['cors_origins'] ?? []);
$method = Http::method();
$path = Http::path();
$images = new Images($cfg);

if ($method === 'OPTIONS') { http_response_code(204); exit; }

// El POST superó post_max_size: PHP vacía $_POST y $_FILES sin avisar.
function iniBytes(string $v): int
{
    $n = (int)$v; $u = strtolower(substr(trim($v), -1));
    return match ($u) { 'g' => $n * 1073741824, 'm' => $n * 1048576, 'k' => $n * 1024, default => $n };
}
$postMax = iniBytes((string)ini_get('post_max_size'));
if ($method === 'POST' && empty($_FILES) && empty($_POST) && $postMax > 0 && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $postMax) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'La petición supera el tamaño que acepta el servidor (post_max_size).', ['content_length' => (int)$_SERVER['CONTENT_LENGTH']]);
}

// ------------------------------------------------------------------ helpers de ruta

function allow(string $method, array $allowed): void
{
    if ($method === 'HEAD' && in_array('GET', $allowed, true)) return;
    if (!in_array($method, $allowed, true)) {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', "Método $method no permitido en esta ruta.", ['allowed' => $allowed]);
    }
}

/** Valida la llave y devuelve los proyectos que puede usar. */
function authenticate(array $cfg): array
{
    $key = null;
    $auth = Http::header('Authorization');
    if ($auth && preg_match('/^Bearer\s+(\S+)$/i', $auth, $m)) $key = $m[1];
    $key ??= Http::header('X-Api-Key');
    if (!$key) throw new ApiError(401, 'MISSING_API_KEY', 'Falta la llave de API. Envíala en "Authorization: Bearer <llave>" o "X-Api-Key".');
    foreach ($cfg['api_keys'] as $valid => $client) {
        if (hash_equals((string)$valid, $key)) return $client;
    }
    // Diagnóstico sin exponer llaves: huella de lo recibido (respuesta) y de lo configurado (solo en el log).
    $hint = fn(string $k) => (strlen($k) > 10 ? substr($k, 0, 4) . '…' . substr($k, -4) : '(muy corta)') . ' (' . strlen($k) . ' car.)';
    logLine($GLOBALS['logFile'], 'WARN', 'llave inválida recibida=' . $hint($key) . ' configuradas=' . implode(', ', array_map(fn($k) => $hint((string)$k), array_keys($cfg['api_keys']))));
    throw new ApiError(401, 'INVALID_API_KEY', 'La llave de API no es válida.', ['received' => $hint($key)]);
}

function authorizeProject(array $client, string $project): void
{
    $allowed = $client['projects'] ?? [];
    if (!in_array('*', $allowed, true) && !in_array($project, $allowed, true)) {
        throw new ApiError(403, 'PROJECT_FORBIDDEN', "Esta llave no tiene permiso para el proyecto \"$project\".", ['project' => $project]);
    }
}

function rateLimit(array $cfg): void
{
    $limit = (int)($cfg['rate_limit_per_minute'] ?? 0);
    if ($limit <= 0) return;
    $dir = rtrim($cfg['storage_path'], '/') . '/ratelimit';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $window = (int)floor(time() / 60);
    $file = $dir . '/' . sha1(Http::clientIp()) . '-' . $window;
    $fh = fopen($file, 'c+');
    flock($fh, LOCK_EX);
    $count = (int)stream_get_contents($fh) + 1;
    ftruncate($fh, 0); rewind($fh); fwrite($fh, (string)$count);
    flock($fh, LOCK_UN); fclose($fh);
    header('X-RateLimit-Limit: ' . $limit);
    header('X-RateLimit-Remaining: ' . max(0, $limit - $count));
    if ($count > $limit) {
        throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas peticiones. Espera un momento e intenta de nuevo.', ['retry_after' => 60 - (time() % 60)]);
    }
    if (mt_rand(1, 50) === 1) { // limpieza ocasional de ventanas viejas
        foreach (glob("$dir/*") ?: [] as $old) if (filemtime($old) < time() - 180) @unlink($old);
    }
}

// ------------------------------------------------------------------ rutas

if ($path === '/' || $path === '/health') {
    allow($method, ['GET']);
    $store = rtrim($cfg['storage_path'], '/') . '/images';
    if (!is_dir($store)) @mkdir($store, 0755, true);
    $checks = [
        'gd'       => extension_loaded('gd'),
        'webp'     => function_exists('imagewebp'),
        'fileinfo' => extension_loaded('fileinfo'),
        'storage_writable' => is_writable($store),
    ];
    $healthy = $checks['gd'] && $checks['fileinfo'] && $checks['storage_writable'];
    Http::json($healthy ? 200 : 503, ['ok' => $healthy, 'data' => [
        'service' => 'imagenes-api',
        'status'  => $healthy ? 'ok' : 'degraded',
        'php'     => PHP_VERSION,
        'checks'  => $checks,
        'limits'  => [
            'max_upload_bytes' => $cfg['max_upload_bytes'],
            'max_files_per_request' => $cfg['max_files_per_request'],
            'upload_max_filesize (php.ini)' => ini_get('upload_max_filesize'),
            'post_max_size (php.ini)' => ini_get('post_max_size'),
        ],
        'time' => gmdate('c'),
    ]]);
}

// Servir imagen pública: /i/{proyecto}/{archivo}
if (preg_match('#^/i/([^/]+)/([^/]+)$#', $path, $m)) {
    allow($method, ['GET']);
    $project = Images::checkProject($m[1]);
    $file = Images::checkFilename($m[2]);
    $w = isset($_GET['w']) ? filter_var($_GET['w'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5000]]) : null;
    if ($w === false) throw new ApiError(422, 'INVALID_WIDTH', 'El parámetro w debe ser un número entre 1 y 5000.', ['field' => 'w']);
    $fmt = strtolower((string)($_GET['fmt'] ?? ''));
    if ($fmt === 'auto') $fmt = str_contains((string)Http::header('Accept'), 'image/webp') ? 'webp' : '';
    if ($fmt !== '' && $fmt !== 'webp') throw new ApiError(422, 'INVALID_FORMAT', 'fmt solo acepta "webp" o "auto".', ['field' => 'fmt']);
    $images->serve($project, $file, $w ?: null, $fmt);
}

if ($path === '/v1/images') {
    allow($method, ['GET', 'POST']);
    $client = authenticate($cfg);
    rateLimit($cfg);

    if ($method === 'POST') {
        $project = Images::checkProject((string)($_POST['project'] ?? ($client['projects'][0] ?? '')));
        authorizeProject($client, $project);
        $uploads = Images::collectUploads();
        if (!$uploads) throw new ApiError(400, 'NO_FILE', 'No se envió ningún archivo. Usa el campo "file" (o "files[]" para varios) en multipart/form-data.');
        if (count($uploads) > $cfg['max_files_per_request']) {
            throw new ApiError(422, 'TOO_MANY_FILES', sprintf('Máximo %d archivos por petición; enviaste %d.', $cfg['max_files_per_request'], count($uploads)));
        }

        // Un solo archivo: respuesta simple. Varios: cada uno con su resultado.
        if (count($uploads) === 1) {
            $saved = $images->store($uploads[0], $project);
            logLine($GLOBALS['logFile'], 'INFO', "upload {$project}/{$saved['filename']} por {$client['name']}");
            Http::ok($saved, 201);
        }
        $results = []; $okCount = 0;
        foreach ($uploads as $u) {
            try {
                $saved = $images->store($u, $project);
                $results[] = ['ok' => true, 'data' => $saved];
                $okCount++;
            } catch (ApiError $e) {
                $results[] = ['ok' => false, 'original_name' => $u['name'] ?? null, 'error' => ['code' => $e->errorCode, 'message' => $e->getMessage()]];
            }
        }
        logLine($GLOBALS['logFile'], 'INFO', "upload múltiple {$project}: $okCount/" . count($uploads) . " por {$client['name']}");
        // 201 todo bien · 207 parcial · 422 todo falló
        $status = $okCount === count($uploads) ? 201 : ($okCount > 0 ? 207 : 422);
        Http::json($status, ['ok' => $okCount > 0, 'data' => $results, 'meta' => ['uploaded' => $okCount, 'failed' => count($uploads) - $okCount]]);
    }

    // GET: listado paginado
    $project = Images::checkProject((string)($_GET['project'] ?? ($client['projects'][0] ?? '')));
    authorizeProject($client, $project);
    $page = max(1, (int)($_GET['page'] ?? 1));
    $per = min(100, max(1, (int)($_GET['per_page'] ?? 30)));
    $res = $images->list($project, $page, $per);
    Http::ok($res['items'], 200, ['pagination' => $res['pagination']]);
}

if (preg_match('#^/v1/images/([^/]+)/([^/]+)$#', $path, $m)) {
    allow($method, ['GET', 'DELETE']);
    $client = authenticate($cfg);
    rateLimit($cfg);
    $project = Images::checkProject($m[1]);
    authorizeProject($client, $project);
    $file = Images::checkFilename($m[2]);
    if ($method === 'DELETE') {
        $res = $images->delete($project, $file);
        logLine($logFile, 'INFO', "delete {$project}/{$file} por {$client['name']}");
        Http::ok($res);
    }
    Http::ok($images->describe($project, $file));
}

throw new ApiError(404, 'ROUTE_NOT_FOUND', "La ruta $method $path no existe.", ['path' => $path]);
