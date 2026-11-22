(function(){
  var $ = function(s){ return document.querySelector(s); };
  var db = null, user = null, myId = null, canWrite = null, canEditAll = false;
  var items = [], comments = [], names = {}, asked = {};
  var loaded = false, loadFailed = false, loadTimer = null;
  var editingId = null, filaN = 0, confirmId = null, confirmComId = null;
  var drafts = {}, openSet = {}, perfiles = {}, perfilForzado = false;
  var knownRep = null, knownCom = null, recientes = {}, recCom = {};

  /* Mensaje flotante breve */
  function toast(msg){
    var t = h('div', {class:'toast', role:'status', text:msg});
    document.body.appendChild(t);
    setTimeout(function(){ t.classList.add('sale'); setTimeout(function(){ t.remove(); }, 400); }, 2200);
  }
  function confeti(){
    var colores = ['#F2C230', '#2FB36D', '#F0629F', '#8B6CF0', '#5AB0FF'];
    var cont = h('div', {class:'confeti', 'aria-hidden':'true'});
    for (var i = 0; i < 28; i++){
      var p = h('span');
      p.style.setProperty('--dx', ((Math.random() * 2 - 1) * 170).toFixed(0) + 'px');
      p.style.setProperty('--dy', (-(110 + Math.random() * 170)).toFixed(0) + 'px');
      p.style.setProperty('--rot', ((Math.random() * 2 - 1) * 720).toFixed(0) + 'deg');
      p.style.background = colores[i % colores.length];
      p.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
      cont.appendChild(p);
    }
    document.body.appendChild(cont);
    setTimeout(function(){ cont.remove(); }, 1500);
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('.btn');
    if (!b || b.disabled) return;
    var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
    var s = h('span', {class:'onda'});
    s.style.width = s.style.height = d + 'px';
    s.style.left = (e.clientX - r.left - d / 2) + 'px';
    s.style.top = (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s);
    setTimeout(function(){ s.remove(); }, 650);
  });
  var rafLuz = 0;
  document.addEventListener('mousemove', function(e){
    var c = e.target.closest && e.target.closest('.rep, .hoy');
    if (!c || rafLuz) return;
    rafLuz = requestAnimationFrame(function(){
      rafLuz = 0;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
  function marca(obj, id){ obj[id] = true; setTimeout(function(){ delete obj[id]; }, 2500); }
  function arrancaEntrada(){
    document.body.classList.add('entrada');
    setTimeout(function(){ document.body.classList.remove('entrada'); }, 2200);
  }

  function h(tag, attrs, kids){
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs){
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k.slice(0,2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function(c){ if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  /* Fechas: texto AAAA-MM-DD en la hora local de quien mira */
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function todayStr(){ var d = new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function parse(s){ var p = s.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); }
  function fmtLong(s){
    if (!DATE_RE.test(s || '')) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-CO', {weekday:'long', day:'numeric', month:'long', year:'numeric'}).format(parse(s));
  }
  function fmtStamp(ts){
    if (!ts) return '';
    return new Intl.DateTimeFormat('es-CO', {day:'numeric', month:'short', hour:'numeric', minute:'2-digit'}).format(new Date(ts));
  }

  /* Enlaces: solo http(s) */
  function cleanUrl(u){
    u = (u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { var x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch(e){ return ''; }
  }
  function hostOf(u){
    try { return new URL(u).hostname.replace(/^www\./,'').replace(/^m\./,''); } catch(e){ return 'enlace'; }
  }

  /* ---------- Formulario ---------- */
  function addFila(s){
    s = s || {};
    var id = ++filaN;
    var li = h('li', {class:'fila'});
    var num = h('span', {class:'n', text:'1'});
    var t = h('input', {type:'text', id:'ft-'+id, class:'ft', maxlength:'120', placeholder:'Título de la canción', 'aria-label':'Título de la canción'});
    var u = h('input', {type:'url', id:'fu-'+id, class:'fu', maxlength:'500', placeholder:'Enlace (YouTube, Spotify…)', 'aria-label':'Enlace de la canción'});
    t.value = s.titulo || ''; u.value = s.url || '';
    var up = h('button', {type:'button', class:'iconbtn', 'aria-label':'Subir canción', text:'↑', onclick:function(){ var p = li.previousElementSibling; if (p) li.parentNode.insertBefore(li, p); renum(); }});
    var dn = h('button', {type:'button', class:'iconbtn', 'aria-label':'Bajar canción', text:'↓', onclick:function(){ var x = li.nextElementSibling; if (x) li.parentNode.insertBefore(x, li); renum(); }});
    var rm = h('button', {type:'button', class:'iconbtn', 'aria-label':'Quitar canción', text:'×', onclick:function(){ li.remove(); if (!$('#filas').children.length) addFila(); renum(); }});
    li.appendChild(num);
    li.appendChild(h('div', {class:'cols'}, [t,u]));
    li.appendChild(h('div', {class:'acc'}, [up,dn,rm]));
    $('#filas').appendChild(li);
    renum();
    return t;
  }
  function renum(){
    var rows = $('#filas').children;
    for (var i = 0; i < rows.length; i++){
      rows[i].querySelector('.n').textContent = String(i+1);
      rows[i].querySelectorAll('.iconbtn')[0].disabled = (i === 0);
      rows[i].querySelectorAll('.iconbtn')[1].disabled = (i === rows.length - 1);
    }
  }
  function setStatus(msg, err){ var e = $('#estado'); e.textContent = msg || ''; e.className = 'estado' + (err ? ' err' : ''); }

  function openEditor(rep){
    if (!canAdd()) return;
    editingId = rep ? rep.id : null;
    $('#ed-titulo').textContent = rep ? 'Editar repertorio' : 'Nuevo repertorio';
    $('#f-fecha').value = rep ? (rep.fecha || '') : todayStr();
    $('#f-titulo').value = rep ? (rep.titulo || '') : '';
    $('#f-notas').value = rep ? (rep.notas || '') : '';
    $('#filas').textContent = '';
    var songs = rep && Array.isArray(rep.canciones) && rep.canciones.length ? rep.canciones : [{}];
    songs.forEach(function(s){ addFila(s); });
    setStatus('');
    $('#editor').hidden = false;
    $('#btn-guardar').disabled = false;
    $('#editor').scrollIntoView({behavior:'smooth', block:'start'});
    $('#f-titulo').focus({preventScroll:true});
  }
  function closeEditor(){ $('#editor').hidden = true; editingId = null; setStatus(''); }

  async function save(){
    if (!db || !canAdd()) return;
    var fecha = $('#f-fecha').value, titulo = $('#f-titulo').value.trim(), notas = $('#f-notas').value.trim();
    if (!DATE_RE.test(fecha)) return setStatus('Elige la fecha del repertorio.', true);
    if (!titulo) return setStatus('Escribe un nombre para el repertorio.', true);
    var canciones = [], bad = false;
    Array.prototype.forEach.call($('#filas').children, function(li){
      var t = li.querySelector('.ft').value.trim(), raw = li.querySelector('.fu').value.trim();
      if (!t && !raw) return;
      var u = cleanUrl(raw);
      if (raw && !u) bad = true;
      if (!t) t = u ? hostOf(u) : 'Sin título';
      canciones.push({titulo:t, url:u});
    });
    if (bad) return setStatus('Uno de los enlaces no es válido. Revisa que empiece con https://', true);
    if (!canciones.length) return setStatus('Agrega al menos una canción.', true);

    var eraEdicion = !!editingId;
    var prev = editingId ? items.filter(function(i){ return i.id === editingId; })[0] : null;
    var now = Date.now();
    var body = {fecha:fecha, titulo:titulo, notas:notas, canciones:canciones, creado: prev && prev.creado ? prev.creado : now, editado: now};
    $('#btn-guardar').disabled = true;
    setStatus('Guardando…');
    try {
      var ref = editingId ? db.collection('repertorios').doc(editingId) : db.collection('repertorios').doc();
      await ref.set(body);
      closeEditor();
      toast(eraEdicion ? 'Repertorio actualizado' : 'Repertorio guardado');
      if (!eraEdicion) confeti();
    } catch(e){
      var msg = 'No se pudo guardar. Intenta de nuevo.';
      if (e && (e.code === 'invalid_argument' || e.code === 'permission-denied')) msg = 'No tienes permiso para guardar en este repertorio.';
      if (e && (e.code === 'quota_exceeded' || e.code === 'resource-exhausted')) msg = 'Se llenó el espacio de la página. Elimina repertorios viejos.';
      setStatus(msg, true);
      $('#btn-guardar').disabled = false;
    }
  }

  async function remove(id){
    if (!db || !canAdd()) return;
    try {
      await db.collection('repertorios').doc(id).delete();
      confirmId = null;
      var propios = comments.filter(function(c){ return c.repId === id; });
      await Promise.all(propios.map(function(c){ return db.collection('comentarios').doc(c.id).delete().catch(function(){}); }));
    } catch(e){ confirmId = null; render(); showAviso('No se pudo eliminar. Puede que no tengas permiso.'); }
  }

  function errFirebase(err, que){
    var code = err && err.code ? err.code : 'desconocido';
    if (code === 'permission-denied') showAviso('Firebase no deja ' + que + ' (permission-denied). Revisa que publicaste las reglas de firestore.rules en Firestore > Reglas.');
    else showAviso('Error de Firebase al ' + que + ': ' + code);
  }

  function showAviso(msg){ var a = $('#aviso'); a.textContent = msg || ''; a.hidden = !msg; }

  /* ---------- Perfil: nombre y cargo ---------- */
  var CARGOS = {alabanza:'Alabanza', danza:'Danza', pastor:'Pastor', sonidista:'Sonidista'};
  function mine(){ return myId && perfiles[myId] ? perfiles[myId] : null; }
  /* Todos los ministerios de una persona: el principal y los otros en los que sirve */
  function rolesOf(p){
    var r = [];
    if (!p) return r;
    if (p.cargo) r.push(p.cargo);
    (Array.isArray(p.otros) ? p.otros : []).forEach(function(x){ if (r.indexOf(x) < 0) r.push(x); });
    return r;
  }
  function rolesText(p){ return rolesOf(p).map(function(r){ return CARGOS[r] || r; }).join(' · '); }
  function chipRol(r){ return h('span', {class:'chip rol rol-' + r, text:CARGOS[r] || r}); }
  function avatar(p){
    var r = rolesOf(p)[0] || '', ini = ((p && p.nombre) || '?').trim().charAt(0).toUpperCase() || '?';
    return h('span', {class:'avatar' + (r ? ' rol-' + r : ''), 'aria-hidden':'true', text:ini});
  }
  function tiene(rol){ return rolesOf(mine()).indexOf(rol) >= 0; }
  function canAdd(){ return canWrite !== false && tiene('alabanza'); }
  function canSeePast(){ return tiene('alabanza') || tiene('pastor'); }
  function paintYo(){
    var m = mine(), el = $('#yo');
    el.textContent = '';
    if (m){
      el.hidden = false;
      el.appendChild(avatar(m));
      el.appendChild(h('span', {class:'saludo', text:'Hola, ' + (m.nombre || '')}));
      rolesOf(m).forEach(function(r){ el.appendChild(chipRol(r)); });
    } else el.hidden = true;
    $('#btn-nuevo').hidden = !canAdd();
    if (canWrite !== false) showAviso(m && !tiene('alabanza') ? 'Solo el equipo de alabanza puede agregar repertorios. Tú puedes verlos y comentar.' : '');
  }
  function openPerfil(forced){
    perfilForzado = forced;
    var m = mine();
    $('#p-nombre').value = m ? (m.nombre || '') : '';
    Array.prototype.forEach.call(document.querySelectorAll('input[name=cargo]'), function(r){ r.checked = !!m && r.value === m.cargo; });
    $('#p-otro').checked = !!(m && Array.isArray(m.otros) && m.otros.length);
    Array.prototype.forEach.call(document.querySelectorAll('input[name=otros]'), function(c){ c.checked = !!(m && Array.isArray(m.otros) && m.otros.indexOf(c.value) >= 0); });
    syncOtros();
    $('#p-err').textContent = '';
    $('#p-guardar').disabled = false;
    $('#p-cancel').hidden = forced;
    $('#perfil').hidden = false;
    $('#p-nombre').focus();
  }
  /* Muestra la lista de otros ministerios solo si marcó que sirve en otro, y quita el que ya eligió como principal */
  function syncOtros(){
    var principal = document.querySelector('input[name=cargo]:checked');
    var si = $('#p-otro').checked;
    $('#p-otros-box').hidden = !si;
    Array.prototype.forEach.call(document.querySelectorAll('input[name=otros]'), function(c){
      var igual = !!principal && c.value === principal.value;
      var fila = c.closest('label');
      if (fila) fila.hidden = igual;
      if (igual) c.checked = false;
    });
  }
  async function savePerfil(){
    var nombre = $('#p-nombre').value.trim();
    var sel = document.querySelector('input[name=cargo]:checked');
    var err = $('#p-err');
    if (!nombre){ err.textContent = 'Escribe tu nombre.'; return; }
    if (!sel){ err.textContent = 'Elige tu cargo.'; return; }
    var otros = [];
    if ($('#p-otro').checked){
      Array.prototype.forEach.call(document.querySelectorAll('input[name=otros]:checked'), function(c){ if (c.value !== sel.value) otros.push(c.value); });
      if (!otros.length){ err.textContent = 'Marca en cuál otro ministerio sirves, o desmarca la casilla.'; return; }
    }
    if (!db || !myId){ err.textContent = 'No se pudo identificar tu cuenta. Recarga la página.'; return; }
    $('#p-guardar').disabled = true; err.textContent = '';
    try {
      var ref = db.collection('perfiles').doc(myId);
      var actual = await ref.get();
      if (actual.exists){ $('#perfil').hidden = true; return; }
      await ref.set({nombre:nombre, cargo:sel.value, otros:otros, creado:Date.now()});
      $('#perfil').hidden = true;
      toast('Bienvenido, ' + nombre);
    } catch(e){
      err.textContent = 'No se pudo guardar. Intenta de nuevo.';
      $('#p-guardar').disabled = false;
    }
  }

  /* ---------- Comentarios ---------- */
  async function addComment(repId, btn){
    var texto = (drafts[repId] || '').trim();
    if (!texto || !db) return;
    btn.disabled = true;
    try {
      await db.collection('comentarios').add({repId:repId, autor:myId || '', texto:texto.slice(0, 500), ts:Date.now()});
      drafts[repId] = '';
      openSet[repId] = true;
      render();
      toast('Comentario enviado');
    } catch(e){
      btn.disabled = false;
      showAviso(e && (e.code === 'invalid_argument' || e.code === 'permission-denied') ? 'No tienes permiso para comentar.' : 'No se pudo enviar el comentario. Intenta de nuevo.');
    }
  }
  async function delComment(id){
    try { await db.collection('comentarios').doc(id).delete(); } catch(e){ showAviso('No se pudo eliminar el comentario.'); }
    confirmComId = null;
    render();
  }
  async function resolveNames(){
    if (!user || !user.profiles) return;
    var ids = [];
    comments.forEach(function(c){ if (c.autor && !asked[c.autor] && ids.indexOf(c.autor) < 0) ids.push(c.autor); });
    if (myId && !asked[myId] && ids.indexOf(myId) < 0) ids.push(myId);
    if (!ids.length) return;
    ids.forEach(function(i){ asked[i] = true; });
    try {
      var ps = await user.profiles(ids);
      ids.forEach(function(i){ names[i] = (ps && ps[i] && ps[i].name) || ''; });
      render();
    } catch(e){}
  }
  function nameOf(id){
    var p = id && perfiles[id];
    var base = (p && p.nombre) || (id && names[id]) || 'Alguien';
    return id && id === myId ? base + ' (tú)' : base;
  }

  function commentBlock(rep){
    var list = comments.filter(function(c){ return c.repId === rep.id; }).sort(function(a,b){ return (a.ts||0) - (b.ts||0); });
    var d = h('details', {class:'coment'});
    if (openSet[rep.id]) d.open = true;
    d.addEventListener('toggle', function(){ openSet[rep.id] = d.open; });
    d.appendChild(h('summary', {text:'Comentarios (' + list.length + ')'}));
    var body = h('div', {class:'com-cuerpo'});
    if (list.length){
      var ul = h('ul', {class:'com-lista'});
      list.forEach(function(c){
        var pf = c.autor && perfiles[c.autor];
        var meta = h('div', {class:'com-meta'}, [
          pf ? avatar(pf) : null,
          h('b', {text:nameOf(c.autor)})
        ].concat(pf ? rolesOf(pf).map(chipRol) : [], [h('time', {text:fmtStamp(c.ts)})]));
        if (canWrite !== false && ((c.autor && c.autor === myId) || canEditAll)){
          if (confirmComId === c.id){
            meta.appendChild(h('button', {type:'button', class:'btn small', text:'Sí, eliminar', onclick:function(){ delComment(c.id); }}));
            meta.appendChild(h('button', {type:'button', class:'btn small ghost', text:'No', onclick:function(){ confirmComId = null; render(); }}));
          } else {
            meta.appendChild(h('button', {type:'button', class:'btn small ghost', text:'Eliminar', onclick:function(){ confirmComId = c.id; render(); }}));
          }
        }
        ul.appendChild(h('li', {class:'com-item' + (recCom[c.id] ? ' nuevo-com' : '')}, [meta, h('p', {class:'com-txt', text:c.texto || ''})]));
      });
      body.appendChild(ul);
    } else body.appendChild(h('p', {class:'com-vacio', text:'Todavía no hay comentarios.'}));
    if (canWrite !== false){
      var ta = h('textarea', {id:'c-' + rep.id, maxlength:'500', placeholder:'Escribe un comentario para el grupo', 'aria-label':'Escribir un comentario'});
      ta.value = drafts[rep.id] || '';
      ta.addEventListener('input', function(){ drafts[rep.id] = ta.value; btn.disabled = !ta.value.trim(); });
      var btn = h('button', {type:'button', class:'btn small primary', text:'Comentar'});
      btn.disabled = !ta.value.trim();
      btn.addEventListener('click', function(){ addComment(rep.id, btn); });
      body.appendChild(h('div', {class:'com-form'}, [ta, btn]));
    } else body.appendChild(h('p', {class:'com-vacio', text:'Necesitas permiso de colaborador para comentar.'}));
    d.appendChild(body);
    return d;
  }

  /* ---------- Lista ---------- */
  function copyText(rep){
    var l = [rep.titulo + ' — ' + fmtLong(rep.fecha)];
    if (rep.notas) l.push(rep.notas);
    l.push('');
    (rep.canciones || []).forEach(function(s, i){
      l.push((i+1) + '. ' + s.titulo + (s.url ? '\n   ' + s.url : ''));
    });
    return l.join('\n');
  }
  async function copy(rep, btn){
    var txt = copyText(rep), ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch(e){
      var ta = h('textarea', {style:'position:fixed;left:-9999px'}); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch(e2){}
      ta.remove();
    }
    var old = btn.textContent; btn.textContent = ok ? 'Copiado' : 'No se pudo copiar';
    setTimeout(function(){ btn.textContent = old; }, 1600);
  }

  function repCard(rep, isHoy){
    var songs = Array.isArray(rep.canciones) ? rep.canciones : [];
    var cab = h('div', {class:'cab'}, [
      h('div', {class:'cab-txt'}, [
        isHoy ? h('span', {class:'etq', text:'HOY'}) : null,
        h('h3', {text: rep.titulo || 'Sin nombre'}),
        h('span', {class:'fecha', text: fmtLong(rep.fecha)})
      ]),
      h('span', {class:'chip', text: songs.length + (songs.length === 1 ? ' canción' : ' canciones')})
    ]);
    var lis = songs.map(function(s, i){
      var url = cleanUrl(s && s.url);
      var t = h('span', {class:'t', text:(s && s.titulo) || 'Sin título'});
      var a = url ? h('a', {href:url, target:'_blank', rel:'noopener noreferrer', text:'Abrir en ' + hostOf(url)}) : h('span');
      return h('li', null, [h('span', {class:'n', text:String(i+1)}), t, a]);
    });
    var pie = h('div', {class:'pie'});
    var cpBtn = h('button', {type:'button', class:'btn small ghost', text:'Copiar lista'});
    cpBtn.addEventListener('click', function(){ copy(rep, cpBtn); });
    pie.appendChild(cpBtn);
    if (canAdd()){
      pie.appendChild(h('button', {type:'button', class:'btn small ghost', text:'Editar', onclick:function(){ openEditor(rep); }}));
      if (confirmId === rep.id){
        pie.appendChild(h('span', {class:'muted', text:'¿Eliminar este repertorio?'}));
        pie.appendChild(h('button', {type:'button', class:'btn small', text:'Sí, eliminar', onclick:function(){ remove(rep.id); }}));
        pie.appendChild(h('button', {type:'button', class:'btn small ghost', text:'No', onclick:function(){ confirmId = null; render(); }}));
      } else {
        pie.appendChild(h('button', {type:'button', class:'btn small ghost', text:'Eliminar', onclick:function(){ confirmId = rep.id; render(); }}));
      }
    }
    return h('article', {class: (isHoy ? 'hoy' : 'rep') + (recientes[rep.id] ? ' nuevo' : '')}, [
      cab,
      rep.notas ? h('p', {class:'nota', text:rep.notas}) : null,
      h('ol', {class:'temas'}, lis),
      pie,
      commentBlock(rep)
    ]);
  }

  function render(){
    /* Conserva el cursor si alguien está escribiendo un comentario */
    var ae = document.activeElement, keep = null;
    if (ae && ae.tagName === 'TEXTAREA' && ae.id && ae.id.indexOf('c-') === 0){
      keep = {id:ae.id, s:ae.selectionStart, e:ae.selectionEnd};
    }
    var box = $('#contenido'); box.textContent = '';
    build(box);
    if (keep){
      var el = document.getElementById(keep.id);
      if (el){ el.focus({preventScroll:true}); try { el.setSelectionRange(keep.s, keep.e); } catch(e){} }
    }
  }

  function build(box){
    if (loadFailed && !loaded){
      box.appendChild(h('div', {class:'vacio'}, [h('strong', {text:'No se pudieron cargar los repertorios'}), h('span', {text:'Revisa tu conexión. Se actualizarán solos cuando responda el servidor.'})]));
      return;
    }
    if (!loaded){ box.appendChild(h('div', {class:'vacio'}, [h('span', {text:'Cargando repertorios…'})])); return; }
    var today = todayStr();
    var valid = function(r){ return DATE_RE.test(r.fecha || ''); };
    var hoy = items.filter(function(r){ return r.fecha === today; }).sort(function(a,b){ return (a.creado||0) - (b.creado||0); });
    var prox = items.filter(function(r){ return valid(r) && r.fecha > today; }).sort(function(a,b){ return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.creado||0) - (b.creado||0); });
    var pas = items.filter(function(r){ return !valid(r) || r.fecha < today; }).sort(function(a,b){ return (b.fecha||'') < (a.fecha||'') ? -1 : (b.fecha||'') > (a.fecha||'') ? 1 : 0; });

    if (!items.length){
      var kids = [h('strong', {text:'Aún no hay repertorios'})];
      if (canAdd()){
        kids.push(h('span', {text:'Crea el primero con la fecha, el nombre y las canciones con sus enlaces.'}));
        kids.push(h('button', {type:'button', class:'btn primary', text:'Crear el primer repertorio', onclick:function(){ openEditor(null); }}));
      } else kids.push(h('span', {text:'Cuando alguien del equipo de alabanza agregue uno, aparecerá aquí.'}));
      box.appendChild(h('div', {class:'vacio'}, kids));
      if (canSeePast()){
        var s0 = h('section', {class:'sec', style:'margin-top:28px', 'aria-label':'Repertorios anteriores'});
        s0.appendChild(h('h2', {text:'Anteriores (0)'}));
        s0.appendChild(h('div', {class:'vacio'}, [h('strong', {text:'Aún no hay repertorios anteriores'}), h('span', {text:'Cuando pase la fecha de un repertorio, se guarda aquí para que Alabanza y Pastor lo consulten.'})]));
        box.appendChild(s0);
      }
      return;
    }
    var wrap = h('div', {class:'wrap', style:'gap:28px'});
    var s1 = h('section', {class:'sec', 'aria-label':'Repertorio de hoy'});
    s1.appendChild(h('h2', {text:'Hoy'}));
    if (hoy.length) hoy.forEach(function(r){ s1.appendChild(repCard(r, true)); });
    else s1.appendChild(h('div', {class:'vacio'}, [h('span', {text:'No hay repertorio para hoy.'})]));
    wrap.appendChild(s1);

    var s2 = h('section', {class:'sec', 'aria-label':'Próximos repertorios'});
    s2.appendChild(h('h2', {text:'Próximos'}));
    if (prox.length){ var l = h('div', {class:'lista'}); prox.forEach(function(r){ l.appendChild(repCard(r, false)); }); s2.appendChild(l); }
    else s2.appendChild(h('div', {class:'vacio'}, [h('span', {text:'No hay repertorios futuros todavía.'})]));
    wrap.appendChild(s2);

    if (canSeePast()){
      var s3 = h('section', {class:'sec', 'aria-label':'Repertorios anteriores'});
      s3.appendChild(h('h2', {text:'Anteriores (' + pas.length + ')'}));
      if (pas.length){
        var l2 = h('div', {class:'lista'}); pas.forEach(function(r){ l2.appendChild(repCard(r, false)); }); s3.appendChild(l2);
      } else {
        s3.appendChild(h('div', {class:'vacio'}, [h('strong', {text:'Aún no hay repertorios anteriores'}), h('span', {text:'Cuando pase la fecha de un repertorio, se guarda aquí para que Alabanza y Pastor lo consulten.'})]));
      }
      wrap.appendChild(s3);
    }
    box.appendChild(wrap);
  }

  /* ---------- Arranque ---------- */
  $('#hoy-txt').textContent = 'Hoy es ' + fmtLong(todayStr()) + '.';
  $('#btn-nuevo').addEventListener('click', function(){ openEditor(null); });
  $('#btn-fila').addEventListener('click', function(){ addFila().focus(); });
  $('#btn-guardar').addEventListener('click', save);
  $('#btn-cancelar').addEventListener('click', closeEditor);

  async function start(){
    var cfg = window.FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.apiKey || cfg.apiKey.indexOf('PEGA') === 0){
      loadFailed = true; render();
      showAviso('Falta configurar Firebase. Abre firebase-config.js y pega los datos de tu proyecto.');
      return;
    }
    try {
      firebase.initializeApp(cfg);
      db = firebase.firestore();
      var cred = await firebase.auth().signInAnonymously();
      myId = cred.user.uid;
    } catch(e){
      loadFailed = true; render();
      showAviso('No se pudo conectar con Firebase. Revisa los datos de firebase-config.js y que el inicio de sesión anónimo esté activado.');
      return;
    }
    if (canWrite === false){ showAviso('Puedes ver los repertorios. Para comentar necesitas permiso de colaborador.'); }

    /* Perfiles: quién es cada persona. Si es la primera vez, se le pide nombre y cargo. */
    $('#p-form').addEventListener('submit', function(e){ e.preventDefault(); savePerfil(); });
    $('#p-cancel').addEventListener('click', function(){ $('#perfil').hidden = true; });
    $('#p-otro').addEventListener('change', syncOtros);
    Array.prototype.forEach.call(document.querySelectorAll('input[name=cargo]'), function(r){ r.addEventListener('change', syncOtros); });
    db.collection('perfiles').onSnapshot(function(snap){
      perfiles = {};
      snap.docs.forEach(function(d){ perfiles[d.id] = d.data() || {}; });
      canEditAll = tiene('alabanza');
      if (!snap.metadata.fromCache && canWrite !== false && myId && !mine() && $('#perfil').hidden) openPerfil(true);
      paintYo();
      render();
    }, function(err){ errFirebase(err, 'leer los perfiles'); });

    loadTimer = setTimeout(function(){ if (!loaded){ loadFailed = true; render(); } }, 10000);
    db.collection('repertorios').onSnapshot(function(snap){
      clearTimeout(loadTimer); loadFailed = false;
      items = snap.docs.map(function(d){ var o = d.data() || {}; o.id = d.id; return o; });
      var yaCargado = loaded;
      if (!snap.metadata.fromCache || snap.size > 0) loaded = true;
      if (knownRep){ items.forEach(function(r){ if (!knownRep[r.id]) marca(recientes, r.id); }); }
      knownRep = {}; items.forEach(function(r){ knownRep[r.id] = 1; });
      if (!yaCargado && loaded) arrancaEntrada();
      render();
    }, function(err){
      clearTimeout(loadTimer);
      if (!loaded){ loadFailed = true; render(); }
      errFirebase(err, 'leer los repertorios');
    });
    db.collection('comentarios').onSnapshot(function(snap){
      comments = snap.docs.map(function(d){ var o = d.data() || {}; o.id = d.id; return o; });
      if (knownCom){ comments.forEach(function(c){ if (!knownCom[c.id]) marca(recCom, c.id); }); }
      knownCom = {}; comments.forEach(function(c){ knownCom[c.id] = 1; });
      render();
      resolveNames();
    }, function(err){ errFirebase(err, 'leer los comentarios'); });
    resolveNames();
  }
  render();
  start();
})();
