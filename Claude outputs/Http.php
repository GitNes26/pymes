<?php
declare(strict_types=1);

/** Excepción con código HTTP y código de error legible para el cliente. */
final class ApiError extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $details = []
    ) {
        parent::__construct($message);
    }
}

final class Http
{
    public static string $requestId = '';

    public static function json(int $status, array $body, array $headers = []): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Request-Id: ' . self::$requestId);
        foreach ($headers as $k => $v) header("$k: $v");
        $body['meta'] = ($body['meta'] ?? []) + ['request_id' => self::$requestId];
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        exit;
    }

    public static function ok(mixed $data, int $status = 200, array $meta = []): never
    {
        self::json($status, ['ok' => true, 'data' => $data] + ($meta ? ['meta' => $meta] : []));
    }

    public static function error(ApiError $e): never
    {
        $err = ['code' => $e->errorCode, 'message' => $e->getMessage()];
        if ($e->details) $err['details'] = $e->details;
        $headers = [];
        if ($e->status === 405 && isset($e->details['allowed'])) $headers['Allow'] = implode(', ', $e->details['allowed']);
        if ($e->status === 429 && isset($e->details['retry_after'])) $headers['Retry-After'] = (string)$e->details['retry_after'];
        if ($e->status === 401) $headers['WWW-Authenticate'] = 'Bearer realm="imagenes"';
        self::json($e->status, ['ok' => false, 'error' => $err], $headers);
    }

    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    /** Ruta relativa al lugar donde vive index.php (sirve en subcarpetas de hosting compartido). */
    public static function path(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
        // Si el .htaccess de la raíz reenvía a public/, la URL pública no trae "/public".
        foreach ([$base, preg_replace('#/public$#', '', $base)] as $b) {
            if ($b !== '' && ($uri === $b || str_starts_with($uri, $b . '/'))) { $uri = substr($uri, strlen($b)); break; }
        }
        $uri = '/' . ltrim(preg_replace('#/{2,}#', '/', rawurldecode($uri)), '/');
        if (str_starts_with($uri, '/index.php')) $uri = substr($uri, 10) ?: '/';
        $uri = rtrim($uri, '/') ?: '/';
        // Respaldo: si el hosting no informa bien la subcarpeta (p. ej. /imagenes-api),
        // se quita todo lo que haya antes de una ruta conocida del servicio.
        if (!preg_match('#^/(health|i/|v1(/|$))#', $uri)) {
            if (preg_match('#^.*?(/(?:health|i/.+|v1(?:/.*)?))$#', $uri, $m)) {
                $uri = $m[1];
            } elseif (!str_contains(trim($uri, '/'), '/') || preg_match('#/public$#', $uri)) {
                $uri = '/'; // raíz de la subcarpeta, p. ej. /imagenes-api
            }
        }
        return $uri;
    }

    public static function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        if (isset($_SERVER[$key])) return $_SERVER[$key];
        if ($name === 'Authorization' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        if (function_exists('getallheaders')) {
            foreach (getallheaders() as $k => $v) if (strcasecmp($k, $name) === 0) return $v;
        }
        return null;
    }

    public static function clientIp(): string
    {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    public static function cors(array $origins): void
    {
        $origin = self::header('Origin');
        if (!$origin) return;
        if (in_array('*', $origins, true)) {
            header('Access-Control-Allow-Origin: *');
        } elseif (in_array($origin, $origins, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        } else {
            return;
        }
        header('Access-Control-Allow-Methods: GET, HEAD, POST, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, X-Api-Key, Content-Type');
        header('Access-Control-Expose-Headers: X-Request-Id');
        header('Access-Control-Max-Age: 86400');
    }
}
