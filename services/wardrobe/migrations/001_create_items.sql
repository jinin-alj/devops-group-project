CREATE TABLE dbo.items (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    category NVARCHAR(20) NOT NULL
        CONSTRAINT CK_items_category CHECK (category IN ('top', 'bottom', 'shoes', 'outerwear')),
    color NVARCHAR(30) NOT NULL,
    warmth TINYINT NOT NULL
        CONSTRAINT CK_items_warmth CHECK (warmth BETWEEN 1 AND 5),
    price DECIMAL(10, 2) NOT NULL
        CONSTRAINT CK_items_price CHECK (price >= 0),
    created_at DATETIME2 NOT NULL
        CONSTRAINT DF_items_created_at DEFAULT SYSUTCDATETIME()
);
