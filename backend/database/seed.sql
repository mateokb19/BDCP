-- ============================================================
-- BDCPolo - Datos iniciales (seed)
-- ============================================================

-- Operarios demo
INSERT INTO operators (name, phone, commission_rate) VALUES
    ('Carlos Mendoza', '555-0001', 30.00),
    ('Ana García',     '555-0002', 30.00),
    ('Luis Torres',    '555-0003', 30.00);

-- Catálogo de servicios
INSERT INTO services (category, name, price_automovil, price_camion_estandar, price_camion_xl) VALUES
    -- Exterior
    ('exterior', 'Lavado Básico',   15.00, 20.00, 25.00),
    ('exterior', 'Lavado Premium',  30.00, 40.00, 50.00),
    ('exterior', 'Pulido',          80.00, 100.00, 120.00),
    ('exterior', 'Encerado',        50.00, 65.00, 80.00),
    -- Interior
    ('interior', 'Limpieza Interior Básica',    25.00, 35.00, 45.00),
    ('interior', 'Limpieza Interior Profunda',  40.00, 55.00, 70.00),
    ('interior', 'Shampoo Tapicería',           60.00, 80.00, 100.00),
    -- Cerámico
    ('ceramico', 'Tratamiento Cerámico Básico',   200.00, 250.00, 300.00),
    ('ceramico', 'Tratamiento Cerámico Premium',  300.00, 380.00, 450.00),
    ('ceramico', 'Tratamiento Cerámico Elite',    500.00, 600.00, 750.00);

-- Categorías de inventario
INSERT INTO inventory_categories (name) VALUES
    ('Productos de Limpieza'),
    ('Ceras y Pulimentos'),
    ('Productos Cerámicos'),
    ('Materiales y Herramientas');

-- Inventario demo
INSERT INTO inventory_items (category_id, name, unit, quantity, min_stock, cost_per_unit) VALUES
    (1, 'Shampoo para autos',  'litros',   10.0, 3.0,  8.50),
    (1, 'Desengrasante',       'litros',    5.0, 2.0,  6.00),
    (1, 'Ambientador',         'unidades', 20.0, 5.0,  2.50),
    (2, 'Cera de carnauba',    'kg',        4.0, 1.0, 25.00),
    (2, 'Pulidor compuesto',   'litros',    3.0, 1.0, 30.00),
    (3, 'Kit cerámico básico', 'unidades',  6.0, 2.0, 80.00),
    (4, 'Microfibra 40x40',    'unidades', 30.0, 10.0, 1.50),
    (4, 'Esponja de aplicación','unidades', 15.0, 5.0, 1.00);

-- Usuario administrador por defecto (password: BDCP123 — cambiar en producción)
-- Hash bcrypt de "BDCP123":
INSERT INTO users (username, password_hash, role) VALUES
    ('admin', '$2b$12$placeholder_change_in_production', 'admin');
