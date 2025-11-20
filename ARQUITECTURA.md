# Arquitectura Backend - PCSYSTEM

## 📋 Descripción General

Este backend centraliza toda la lógica de negocio de PCSYSTEM, proporcionando una API RESTful que maneja productos, autenticación, archivos y contacto.

## 🏗️ Estructura del Proyecto

```
PCSYSTEM-Backend/
├── server.js          # Servidor principal con todas las rutas
├── package.json       # Dependencias del proyecto
├── .env              # Variables de entorno
└── README            # Documentación básica
```

## 🔌 Endpoints Disponibles

### **Productos**

#### GET `/api/pcs`
Obtiene todos los productos ordenados por posición.

**Parámetros de consulta:**
- `page` - Número de página (default: 1)
- `limit` - Productos por página (default: 12)
- `all` - Si es 'true', obtiene todos los productos sin paginación

**Ejemplos:**
```
GET /api/pcs                    # Primera página (12 productos)
GET /api/pcs?page=2             # Segunda página
GET /api/pcs?page=1&limit=24    # 24 productos por página
GET /api/pcs?all=true           # Todos los productos sin paginación
```

**Respuesta (con paginación):**
```json
{
  "data": [
    {
      "id": 1,
      "NOMBRE": "Producto",
      "DETALLE": "Descripción",
      "PRECIO": 50000,
      "CATEGORIA": "Computadores & Cables",
      "SUBCATEGORIA": "Cables",
      "STOCK": 10,
      "POSICION": 1,
      "NUM_VENTAS": 5,
      "IMAGENES": {
        "images": ["url1", "url2"],
        "videos": ["url1"],
        "mainImageIndex": 0,
        "imageCropData": {}
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 150,
    "totalPages": 13,
    "hasMore": true
  }
}
```

**Respuesta (sin paginación con all=true):**
```json
[
  {
    "id": 1,
    "NOMBRE": "Producto",
    ...
  }
]
```

#### GET `/api/pcs/:id`
Obtiene un producto específico por ID.

#### POST `/api/pcs`
Crea un nuevo producto.

**Body:**
```json
{
  "NOMBRE": "Producto nuevo",
  "DETALLE": "Descripción",
  "PRECIO": 50000,
  "CATEGORIA": "Computadores & Cables",
  "STOCK": 10
}
```

#### PUT `/api/pcs/:id`
Actualiza un producto existente.

#### DELETE `/api/pcs/:id`
Elimina un producto.

### **Búsqueda y Filtros**

#### GET `/api/pcs/search`
Busca productos con filtros.

**Parámetros de consulta:**
- `q` - Texto de búsqueda
- `category` - Filtrar por categoría
- `minPrice` - Precio mínimo
- `maxPrice` - Precio máximo
- `inStock` - Solo productos en stock (true/false)
- `page` - Número de página (default: 1)
- `limit` - Productos por página (default: 12)

**Ejemplo:**
```
GET /api/pcs/search?q=cable&category=Computadores%20%26%20Cables&inStock=true&page=1&limit=12
```

**Respuesta:**
```json
{
  "data": [
    {
      "id": 1,
      "NOMBRE": "Cable HDMI",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 25,
    "totalPages": 3,
    "hasMore": true
  }
}
```

#### GET `/api/categories`
Obtiene todas las categorías únicas.

#### GET `/api/pcs/:id/related`
Obtiene productos relacionados (misma categoría).

**Parámetros:**
- `limit` - Número de productos (default: 4)

### **Autenticación**

#### POST `/api/auth/login`
Inicia sesión.

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "session": { ... },
  "user": { ... }
}
```

#### POST `/api/auth/logout`
Cierra sesión.

#### GET `/api/auth/session`
Verifica la sesión actual.

**Headers:**
```
Authorization: Bearer <token>
```

### **Upload de Archivos**

#### POST `/api/upload/image`
Sube una imagen.

**Body (multipart/form-data):**
- `file` - Archivo de imagen

**Respuesta:**
```json
{
  "success": true,
  "url": "https://..."
}
```

#### POST `/api/upload/video`
Sube un video.

**Body (multipart/form-data):**
- `file` - Archivo de video

### **Gestión de Posiciones**

#### PUT `/api/pcs/positions`
Actualiza posiciones de múltiples productos.

**Body:**
```json
{
  "positions": [
    { "id": 1, "POSICION": 1 },
    { "id": 2, "POSICION": 2 },
    { "id": 3, "POSICION": 3 }
  ]
}
```

### **Contacto**

#### POST `/api/contact`
Envía un mensaje de contacto.

**Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+56912345678",
  "service": "Reparación",
  "message": "Necesito información..."
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Mensaje recibido correctamente",
  "whatsappUrl": "https://wa.me/..."
}
```

### **Estadísticas**

#### GET `/api/pcs/low-stock`
Obtiene productos con bajo stock.

**Parámetros:**
- `threshold` - Umbral de stock (default: 5)

#### GET `/api/pcs/top-selling`
Obtiene productos más vendidos.

**Parámetros:**
- `limit` - Número de productos (default: 10)

### **Utilidades**

#### GET `/api/health`
Verifica el estado del servidor.

**Respuesta:**
```json
{
  "status": "OK",
  "service": "PCSYSTEM Backend",
  "uptime": 12345.67,
  "database": "Supabase conectado"
}
```

## 🔧 Configuración

### Variables de Entorno Requeridas

```env
# Puerto del servidor
PORT=3000

# Frontend URL para CORS
FRONTEND_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Email (Opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
CONTACT_EMAIL=contacto@pcsystems.cl
```

### Instalación de Dependencias

```bash
cd PCSYSTEM-Backend
npm install
```

### Ejecutar en Desarrollo

```bash
npm run dev
```

### Ejecutar en Producción

```bash
npm start
```

## 📦 Dependencias

### Principales
- **express** - Framework web
- **@supabase/supabase-js** - Cliente de Supabase
- **multer** - Manejo de archivos
- **nodemailer** - Envío de emails
- **cors** - Habilitar CORS
- **dotenv** - Variables de entorno

### Desarrollo
- **nodemon** - Recarga automática en desarrollo

## 🔒 Seguridad

- **CORS** configurado para permitir solo el frontend autorizado
- **Validación** de datos en todas las rutas
- **Límite de tamaño** de archivos (50MB)
- **Autenticación** con Supabase Auth

## 🚀 Deployment

### Render.com

1. Crear un nuevo Web Service
2. Conectar el repositorio
3. Configurar variables de entorno
4. El servicio se desplegará automáticamente

### Variables de entorno en producción:
- Asegúrate de configurar todas las variables en el dashboard de Render
- `FRONTEND_URL` debe apuntar a tu dominio de producción

## 📝 Notas

- Los archivos se almacenan en Supabase Storage
- La base de datos es Supabase (PostgreSQL)
- El email es opcional, funciona con WhatsApp como fallback
- Todas las rutas retornan JSON

## 🔄 Migración desde Frontend

La lógica de negocio fue movida desde el frontend (Next.js) al backend:

**Antes:**
```typescript
// Frontend llamaba directamente a Supabase
const { data } = await supabase.from('Productos').select('*')
```

**Ahora:**
```typescript
// Frontend llama al backend
const data = await apiService.getPCs()
```

Esto centraliza la lógica y mejora:
- ✅ Seguridad (credenciales solo en backend)
- ✅ Mantenibilidad (cambios en un solo lugar)
- ✅ Escalabilidad (caching, rate limiting, etc.)
- ✅ Separación de responsabilidades
