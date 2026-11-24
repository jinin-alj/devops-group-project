IF OBJECT_ID(N'dbo.wears', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wears (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        item_id INT NOT NULL,
        worn_on DATE NOT NULL
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_wears_item_id_worn_on'
      AND object_id = OBJECT_ID(N'dbo.wears')
)
BEGIN
    CREATE INDEX IX_wears_item_id_worn_on
    ON dbo.wears (item_id, worn_on);
END
