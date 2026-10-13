(function () {
  'use strict';
  var datosEl = document.getElementById('datos');
  var D = datosEl ? JSON.parse(datosEl.textContent) : { productos: {}, base: location.origin };
  var P = D.productos || {};
  var CLAVE = 'unicom_tienda_carrito';
  var ESTATICO = D.modo === 'estatico';
  var carrito = leer();

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function leer() {
    try { var v = JSON.parse(localStorage.getItem(CLAVE) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
  }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(carrito)); } catch (e) { /* sin almacenamiento: el carrito vive solo en esta visita */ } }

  function plata(n) {
    var neg = n < 0; n = Math.abs(Math.round(n * 100) / 100);
    var partes = n.toFixed(2).split('.');
    var ent = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + '$ ' + ent + (partes[1] === '00' ? '' : ',' + partes[1]);
  }

  var toastEl;
  function aviso(txt) {
    if (!toastEl) { toastEl = el('div', 'toast'); toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = txt; toastEl.classList.add('v');
    clearTimeout(aviso.t); aviso.t = setTimeout(function () { toastEl.classList.remove('v'); }, 2400);
  }

  // Producto que ya no existe (se borró o se despublicó) se saca solo del carrito.
  function limpiar() {
    Object.keys(carrito).forEach(function (id) { if (!P[id] || !(carrito[id] > 0)) delete carrito[id]; });
  }

  function cantidadTotal() { return Object.keys(carrito).reduce(function (a, id) { return a + carrito[id]; }, 0); }
  function totalPlata() { return Object.keys(carrito).reduce(function (a, id) { return a + carrito[id] * P[id].p; }, 0); }

  function pintarContador() {
    limpiar();
    var b = $('#carrito-n'); if (!b) return;
    var n = cantidadTotal(); b.textContent = n; b.hidden = n === 0;
  }

  function agregar(id, delta) {
    var p = P[id]; if (!p) return;
    var actual = carrito[id] || 0, nuevo = actual + delta;
    if (p.sin) { aviso('Este producto no tiene stock'); return; }
    if (p.s != null && nuevo > p.s) { aviso('Solo hay ' + p.s + ' disponible' + (p.s === 1 ? '' : 's')); nuevo = p.s; }
    if (nuevo <= 0) delete carrito[id]; else carrito[id] = nuevo;
    guardar(); pintarContador();
    if (delta > 0 && nuevo > actual) aviso('Agregado: ' + p.n);
    if ($('#panel').classList.contains('abierto')) pintarPanel();
  }

  function compartir(id) {
    var p = P[id]; if (!p) return;
    var url = D.urlProducto ? D.urlProducto.replace('{id}', id) : (D.base || location.origin) + '/tienda/p/' + id;
    var texto = p.n + ' — ' + plata(p.p) + (p.st ? ' · ' + p.st : '');
    if (navigator.share) {
      navigator.share({ title: p.n, text: texto, url: url }).catch(function () { /* canceló */ });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto + '\n' + url).then(function () { aviso('Enlace copiado'); }, function () { window.prompt('Copiá el enlace', url); });
    } else { window.prompt('Copiá el enlace', url); }
  }

  /* ---------- Panel del pedido ---------- */
  var vista = 'carrito';
  var panel = $('#panel'), velo = $('#velo'), cuerpo = $('#panel-cuerpo'), pie = $('#panel-pie'), titulo = $('#panel-titulo');

  function abrir() { vista = 'carrito'; panel.classList.add('abierto'); velo.classList.add('abierto'); pintarPanel(); }
  function cerrar() { panel.classList.remove('abierto'); velo.classList.remove('abierto'); }

  function pintarPanel() {
    limpiar(); cuerpo.textContent = ''; pie.textContent = '';
    if (vista === 'carrito') pintarCarrito(); else if (vista === 'datos') pintarDatos();
  }

  function pintarCarrito() {
    titulo.textContent = 'Tu pedido';
    var ids = Object.keys(carrito);
    if (!ids.length) {
      cuerpo.appendChild(el('p', 'vacio', 'Todavía no agregaste productos.'));
      var seguir = el('button', 'btn', 'Seguir viendo'); seguir.onclick = cerrar; pie.appendChild(seguir);
      return;
    }
    ids.forEach(function (id) {
      var p = P[id], l = el('div', 'linea');
      if (p.f) { var im = el('img'); im.src = p.f; im.alt = ''; l.appendChild(im); } else l.appendChild(el('div', 'mini'));
      var d = el('div', 'd'); d.appendChild(el('b', null, p.n)); d.appendChild(el('span', null, plata(p.p) + ' c/u')); l.appendChild(d);
      var c = el('div', 'cant');
      var menos = el('button', null, '−'); menos.setAttribute('aria-label', 'Quitar uno'); menos.onclick = function () { agregar(id, -1); };
      var mas = el('button', null, '+'); mas.setAttribute('aria-label', 'Agregar uno'); mas.onclick = function () { agregar(id, 1); };
      c.appendChild(menos); c.appendChild(el('span', null, String(carrito[id]))); c.appendChild(mas); l.appendChild(c);
      cuerpo.appendChild(l);
    });
    var t = el('div', 'total'); t.appendChild(el('span', null, 'Total')); t.appendChild(el('span', null, plata(totalPlata()))); pie.appendChild(t);
    pie.appendChild(el('p', 'nota', ESTATICO ? 'Tu pedido se envía por WhatsApp al local, que te confirma disponibilidad y retiro. Los precios incluyen IVA.' : 'Reservás ahora y pagás al retirar en el local. Los precios incluyen IVA.'));
    var sig = el('button', 'btn btn-ac', 'Continuar'); sig.onclick = function () { vista = 'datos'; pintarPanel(); }; pie.appendChild(sig);
  }

  function campo(id, etiqueta, tipo, requerido, extra) {
    var w = el('div', 'campo'), l = el('label', null, etiqueta + (requerido ? ' *' : '')); l.htmlFor = id;
    var i = tipo === 'textarea' ? el('textarea') : el('input'); i.id = id;
    if (tipo !== 'textarea') i.type = tipo; else i.rows = 2;
    if (extra) Object.keys(extra).forEach(function (k) { i.setAttribute(k, extra[k]); });
    w.appendChild(l); w.appendChild(i); return w;
  }

  function pintarDatos() {
    titulo.textContent = 'Tus datos';
    var f = el('form'); f.id = 'form-pedido'; f.noValidate = true;
    var err = el('div', 'error'); err.hidden = true; f.appendChild(err);
    f.appendChild(campo('f-nombre', 'Nombre y apellido', 'text', true, { autocomplete: 'name', maxlength: '120' }));
    f.appendChild(campo('f-tel', 'Teléfono / WhatsApp', 'tel', true, { autocomplete: 'tel', maxlength: '40', inputmode: 'tel' }));
    f.appendChild(campo('f-mail', 'Email (opcional)', 'email', false, { autocomplete: 'email', maxlength: '120' }));
    f.appendChild(campo('f-dir', 'Dirección de envío (opcional)', 'text', false, { autocomplete: 'street-address', maxlength: '200' }));
    f.appendChild(campo('f-notas', 'Aclaraciones (opcional)', 'textarea', false, { maxlength: '400' }));
    f.appendChild(el('p', 'nota', 'Si dejás dirección coordinamos el envío; si no, lo retirás en el local.'));
    cuerpo.appendChild(f);
    try { var g = JSON.parse(localStorage.getItem('unicom_tienda_datos') || '{}'); if (g.n) $('#f-nombre').value = g.n; if (g.t) $('#f-tel').value = g.t; if (g.e) $('#f-mail').value = g.e; } catch (e) { /* sin datos guardados */ }

    var t = el('div', 'total'); t.appendChild(el('span', null, 'Total')); t.appendChild(el('span', null, plata(totalPlata()))); pie.appendChild(t);
    var enviar = el('button', 'btn btn-ac', ESTATICO ? 'Enviar pedido por WhatsApp' : 'Confirmar reserva'); enviar.type = 'submit'; enviar.setAttribute('form', 'form-pedido');
    var volver = el('button', 'btn', 'Volver'); volver.onclick = function () { vista = 'carrito'; pintarPanel(); };
    pie.appendChild(enviar); pie.appendChild(volver);

    f.onsubmit = function (ev) {
      ev.preventDefault();
      var nombre = $('#f-nombre').value.trim(), tel = $('#f-tel').value.trim();
      function fallo(m) { err.textContent = m; err.hidden = false; }
      if (!nombre) return fallo('Ingresá tu nombre.');
      if (tel.replace(/\D/g, '').length < 6) return fallo('Ingresá un teléfono para poder avisarte.');
      var mail = $('#f-mail').value.trim();
      if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return fallo('El email no parece válido.');
      if (ESTATICO) return enviarPorWhatsapp(nombre, tel, mail);
      enviar.disabled = true; enviar.textContent = 'Enviando…'; err.hidden = true;
      var items = Object.keys(carrito).map(function (id) { return { producto_id: Number(id), cantidad: carrito[id] }; });
      fetch('/api/tienda/pedidos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_nombre: nombre, cliente_telefono: tel, cliente_email: mail || null, direccion_envio: $('#f-dir').value.trim() || null, notas: $('#f-notas').value.trim() || null, items: items })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (r) {
          if (!r.ok) throw new Error(r.j.error || 'No pudimos registrar el pedido. Probá de nuevo.');
          try { localStorage.setItem('unicom_tienda_datos', JSON.stringify({ n: nombre, t: tel, e: mail })); } catch (e) { /* ok */ }
          var resumen = Object.keys(carrito).map(function (id) { return carrito[id] + ' x ' + P[id].n; }).join(', ');
          var total = totalPlata();
          carrito = {}; guardar(); pintarContador();
          pintarListo(r.j.id, total, resumen);
        })
        .catch(function (e) { fallo(e.message); enviar.disabled = false; enviar.textContent = 'Confirmar reserva'; });
    };
  }

  // Versión publicada en la nube: no hay servidor para guardar la reserva, así que el pedido sale como mensaje de WhatsApp al local.
  function enviarPorWhatsapp(nombre, tel, mail) {
    if (!D.whatsapp) { aviso('Esta tienda todavía no tiene un WhatsApp para recibir pedidos'); return; }
    var lineas = Object.keys(carrito).map(function (id) { return '• ' + carrito[id] + ' x ' + P[id].n + ' — ' + plata(P[id].p * carrito[id]); });
    var total = totalPlata();
    var texto = 'Hola! Quiero reservar este pedido:\n' + lineas.join('\n') + '\nTotal: ' + plata(total) +
      '\n\nNombre: ' + nombre + '\nTeléfono: ' + tel + (mail ? '\nEmail: ' + mail : '') +
      ($('#f-dir').value.trim() ? '\nEnvío a: ' + $('#f-dir').value.trim() : '\nRetiro en el local') +
      ($('#f-notas').value.trim() ? '\nAclaraciones: ' + $('#f-notas').value.trim() : '');
    var url = 'https://wa.me/' + D.whatsapp + '?text=' + encodeURIComponent(texto);
    try { localStorage.setItem('unicom_tienda_datos', JSON.stringify({ n: nombre, t: tel, e: mail })); } catch (e) { /* ok */ }
    carrito = {}; guardar(); pintarContador();
    vista = 'listo'; cuerpo.textContent = ''; pie.textContent = ''; titulo.textContent = 'Casi listo';
    var w = el('div', 'listo');
    w.appendChild(el('h3', null, 'Enviá el mensaje por WhatsApp'));
    w.appendChild(el('p', 'nota', 'Te abrimos WhatsApp con tu pedido armado (' + plata(total) + '). Tocá enviar para que el local lo reciba y te confirme.'));
    cuerpo.appendChild(w);
    var a = el('a', 'btn btn-ac', 'Abrir WhatsApp'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; pie.appendChild(a);
    var ok = el('button', 'btn', 'Cerrar'); ok.onclick = cerrar; pie.appendChild(ok);
    window.open(url, '_blank', 'noopener');
  }

  function pintarListo(nro, total, resumen) {
    vista = 'listo'; cuerpo.textContent = ''; pie.textContent = ''; titulo.textContent = 'Reserva enviada';
    var w = el('div', 'listo');
    w.appendChild(el('div', null, '¡Gracias!'));
    w.appendChild(el('h3', null, 'Tu pedido quedó reservado'));
    w.appendChild(el('div', 'nro', '#' + nro));
    w.appendChild(el('p', 'nota', 'Total estimado ' + plata(total) + '. Te vamos a avisar cuando esté listo para retirar y pagás en el local.'));
    cuerpo.appendChild(w);
    if (D.whatsapp) {
      var a = el('a', 'btn', 'Avisar por WhatsApp'); a.target = '_blank'; a.rel = 'noopener';
      a.href = 'https://wa.me/' + D.whatsapp + '?text=' + encodeURIComponent('Hola! Reservé el pedido #' + nro + ' en la tienda: ' + resumen + ' (' + plata(total) + ').');
      pie.appendChild(a);
    }
    var ok = el('button', 'btn btn-ac', 'Cerrar'); ok.onclick = cerrar; pie.appendChild(ok);
  }

  /* ---------- Catálogo: buscar y filtrar ---------- */
  var q = $('#q'), cats = $$('.cat'), tarjetas = $$('.grid .card[data-n]'), catActual = '';
  function sinTildes(s) { return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() : s.toLowerCase(); }
  function filtrar() {
    var t = q ? sinTildes(q.value.trim()) : '', visibles = 0;
    tarjetas.forEach(function (c) {
      var ok = (!catActual || c.getAttribute('data-c') === catActual) && (!t || c.getAttribute('data-n').indexOf(t) !== -1);
      c.hidden = !ok; if (ok) visibles++;
    });
    var v = $('#sin-resultados'); if (v) v.hidden = visibles !== 0;
  }
  if (q) q.addEventListener('input', filtrar);
  cats.forEach(function (b) {
    b.addEventListener('click', function () {
      catActual = b.getAttribute('data-c') || '';
      cats.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      filtrar();
    });
  });
  var inicial = new URLSearchParams(location.search).get('cat');
  if (inicial) { var bi = cats.filter(function (b) { return b.getAttribute('data-c') === inicial; })[0]; if (bi) bi.click(); }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-accion]'); if (!b) return;
    var a = b.getAttribute('data-accion'), id = b.getAttribute('data-id');
    if (a === 'agregar') agregar(id, 1);
    else if (a === 'compartir') compartir(id);
    else if (a === 'carrito') abrir();
    else if (a === 'cerrar') cerrar();
    else if (a === 'compartir-tienda') {
      var u = D.urlTienda || ((D.base || location.origin) + '/tienda'); var tx = (D.nombre || 'Nuestra tienda') + ' — mirá los productos, precios y stock:';
      if (navigator.share) navigator.share({ title: D.nombre || 'Tienda', text: tx, url: u }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(tx + '\n' + u).then(function () { aviso('Enlace copiado'); });
    }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') cerrar(); });

  var act = $('#actualizado');
  if (act && D.estado && window.fetch) {
    fetch(D.estado, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.publicado_en) act.textContent = 'Precios y stock actualizados el ' + new Date(j.publicado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    }).catch(function () {});
  }

  pintarContador();
})();
