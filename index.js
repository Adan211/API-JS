// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
app.use(cors());

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

app.get('/reporte_ventas', async (req, res) => {
  const fechaStr = req.query.fecha;
  if (!fechaStr) return res.status(400).json({ error: "Parámetro 'fecha' es obligatorio" });

  try {
    const fechaInicio = new Date(fechaStr);
    if (isNaN(fechaInicio)) throw new Error("Fecha inválida");

    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + 1);

    await sql.connect(config);

    const query = `
      SELECT
        ROUND(SUM(totalbebidas), 2) AS Bebidas,
        ROUND(SUM(totalalimentos), 2) AS Alimentos,
        ROUND(SUM(otros), 2) AS Otros,
        ROUND(SUM(totalbebidas + totalalimentos + otros + totalimpuesto1), 2) AS VentaTotal,
        ROUND(SUM(totalimpuesto1), 2) AS Impuestos,
        ROUND(SUM(totaldescuentoycortesia), 2) AS DescCortesias,

        CASE WHEN SUM(totalbebidas + totalalimentos + otros) > 0
          THEN ROUND(SUM(totalbebidas) * 100.0 / SUM(totalbebidas + totalalimentos + otros), 2)
          ELSE 0 END AS PorcentajeBebidas,

        CASE WHEN SUM(totalbebidas + totalalimentos + otros) > 0
          THEN ROUND(SUM(totalalimentos) * 100.0 / SUM(totalbebidas + totalalimentos + otros), 2)
          ELSE 0 END AS PorcentajeAlimentos,

        CASE WHEN SUM(totalbebidas + totalalimentos + otros) > 0
          THEN ROUND(SUM(otros) * 100.0 / SUM(totalbebidas + totalalimentos + otros), 2)
          ELSE 0 END AS PorcentajeOtros

      FROM cheques
      WHERE fecha >= @fechaInicio AND cierre < @fechaFin
    `;

    const request = new sql.Request();
    request.input('fechaInicio', sql.DateTime, fechaInicio);
    request.input('fechaFin', sql.DateTime, fechaFin);

    const result = await request.query(query);

    if (result.recordset.length > 0) {
      const row = result.recordset[0];
      return res.json({
        bebidas: row.Bebidas,
        alimentos: row.Alimentos,
        otros: row.Otros,
        venta_total: row.VentaTotal,
        impuestos: row.Impuestos,
        desc_cortesias: row.DescCortesias,
        porcentaje_bebidas: row.PorcentajeBebidas,
        porcentaje_alimentos: row.PorcentajeAlimentos,
        porcentaje_otros: row.PorcentajeOtros,
      });
    } else {
      return res.status(404).json({ error: 'No se encontraron datos' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
