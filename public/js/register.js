(function(){
  'use strict';
  var form=document.getElementById('register-form');if(!form)return;
  var nameInput=document.getElementById('f-name');
  var slugInput=document.getElementById('f-slug');
  var phoneInput=document.getElementById('f-whatsapp');
  var descriptionInput=document.getElementById('f-description');
  var pinInput=document.getElementById('f-pin');
  var preview=document.getElementById('store-preview');
  var slugTouched=slugInput.value.length>0,readyWasShown=false,changeTimer;

  function slugify(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
  function digits(value,max){return value.replace(/[^0-9]/g,'').slice(0,max)}
  function setValid(input,valid){var shell=input.closest('.input-shell');if(shell)shell.classList.toggle('is-valid',valid)}
  function animatePreview(){preview.classList.remove('is-changing');window.clearTimeout(changeTimer);void preview.offsetWidth;preview.classList.add('is-changing');changeTimer=window.setTimeout(function(){preview.classList.remove('is-changing')},340)}

  function update(){
    var name=nameInput.value.trim(),slug=slugInput.value.trim(),phone=digits(phoneInput.value,10),description=descriptionInput.value.trim(),pin=digits(pinInput.value,12);
    if(pinInput.value!==pin)pinInput.value=pin;
    document.getElementById('preview-name').textContent=name||'Tu negocio';
    document.getElementById('preview-initial').textContent=name?name.charAt(0).toUpperCase():'N';
    document.getElementById('mobile-preview-initial').textContent=name?name.charAt(0).toUpperCase():'N';
    document.getElementById('mobile-preview-name').textContent=name||'Tu tienda está tomando forma';
    document.getElementById('preview-description').textContent=description||'Aquí aparecerá lo que hace especial a tu tienda.';
    document.getElementById('preview-url').textContent=slug?slug+'.nessik.net':'Esperando el nombre';
    document.getElementById('preview-phone').textContent=phone.length===10?'+52 '+phone.replace(/(\d{3})(\d{3})(\d{4})/,'$1 $2 $3'):'Conecta tu WhatsApp';
    document.getElementById('description-count').textContent=descriptionInput.value.length+'/160';

    var identityReady=name.length>=2,linkReady=/^[a-z0-9-]+$/.test(slug),ordersReady=phone.length===10,pinReady=pin.length>=6;
    setValid(nameInput,identityReady);setValid(slugInput,linkReady);setValid(phoneInput,ordersReady);setValid(pinInput,pinReady);
    document.querySelector('[data-step="identity"]').classList.toggle('is-complete',identityReady);
    document.querySelector('[data-step="link"]').classList.toggle('is-complete',linkReady);
    document.querySelector('[data-step="orders"]').classList.toggle('is-complete',ordersReady);

    var complete=[identityReady,linkReady,ordersReady,pinReady].filter(Boolean).length;
    var percent=Math.round(complete/4*100);
    document.getElementById('progress-fill').style.transform='scaleX('+(percent/100)+')';
    document.getElementById('progress-count').textContent=percent+'% listo';
    document.getElementById('mobile-preview-progress').textContent=percent===100?'Lista para abrir y recibir pedidos':percent+'% lista · sigue construyéndola';
    var label='Empecemos por tu negocio',message='Tu tienda aparecerá aquí mientras la creas.';
    if(identityReady){label='Tu negocio ya tiene identidad';message='Ya se reconoce como tu negocio.'}
    if(linkReady&&identityReady){label='Tu tienda ya tiene dirección';message='Ese será el enlace que verán tus clientes.'}
    if(ordersReady&&identityReady){label='Ya podemos conectar tus pedidos';message='Los clientes podrán pedirte directo por WhatsApp.'}
    if(percent===100){label='Todo listo para abrir';message='Sí: esta es tu tienda. Ya está lista para cobrar vida.'}
    document.getElementById('progress-label').textContent=label;
    document.getElementById('preview-message').textContent=message;
    preview.classList.toggle('is-ready',percent===100);
    if(percent===100&&!readyWasShown){readyWasShown=true;preview.classList.remove('is-ready');void preview.offsetWidth;preview.classList.add('is-ready')}else if(percent<100){readyWasShown=false}
  }

  slugInput.addEventListener('input',function(){slugTouched=true;update()});
  nameInput.addEventListener('input',function(){if(!slugTouched)slugInput.value=slugify(this.value);animatePreview();update()});
  descriptionInput.addEventListener('input',function(){animatePreview();update()});
  phoneInput.addEventListener('input',function(){this.value=digits(this.value,10);update()});
  pinInput.addEventListener('input',update);
  document.querySelector('.pin-toggle').addEventListener('click',function(){var show=pinInput.type==='password';pinInput.type=show?'text':'password';this.setAttribute('aria-pressed',String(show));this.setAttribute('aria-label',show?'Ocultar PIN':'Mostrar PIN');pinInput.focus()});
  form.addEventListener('submit',function(event){update();if(!form.checkValidity()){event.preventDefault();form.reportValidity();return}form.classList.add('is-submitting');document.getElementById('submit-button').disabled=true});
  update();
})();
