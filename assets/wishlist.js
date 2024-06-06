var getUrl = window.location;
var baseUrl = getUrl .protocol + "//" + getUrl.host;

var empty_html_message = '<div id="cart-empty" class="noItem"><p>Your Wishlist is currently empty.<p></div>';


if(get_cookie('product_list') != null){
  var products = get_cookie('product_list');
}else{
  var products = [];
}

function set_cookie(name, value) {
   localStorage.setItem(name, JSON.stringify(value));
}

function get_cookie(name) {
  var retrievedObject = localStorage.getItem(name);
  return JSON.parse(retrievedObject);
}

function delete_cookie(name) {
  document.cookie = [name, '=; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; domain=.', window.location.host.toString()].join('');
}

function ReplaceNumberWithCommas(yourNumber) {
  var components = yourNumber.toString().split(".");
  components [0] = components [0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return components.join(".");
}

function get_html(products){
  var html = '';
  html = '<form action="/cart" method="post" novalidate class="cart">';
  html += '<ul>'; 
  $.each( products.reverse(), function( key, value ) {
    if(value.quantity != 0){
      var productUrl = 'https://www.ellabache.com.au/products/'+value.handle;
      html += '<li class="single-product">';
      html += '<div class="prod-info-container">';
      html += '<div class="single-product-img">';
      html += '<a href="'+baseUrl+'/products/'+value.handle+'?variant_id='+value.variant_id+'"><img src="'+value.image+'" alt="image"></a>';
      html += '</div>';
      html += '<div class="details">';
      //html += '<span class="horizontal-loading" id="horizontal-loading-'+value.variant_id+'"><img src="//www.ellabache.com.au/cdn/shop/t/704/assets/horizontal-loading.gif?99288" alt="" /></span>';
      html += '<p class="prod-title"><a class="product-link" href="'+baseUrl+'/products/'+value.handle+'?variant_id='+value.variant_id+'"><span>'+value.title+'</span></a></p>';
        var title = '';
         var producthandle = value.handle;
         var variantid = value.variant_id;
            jQuery.getJSON('/products/'+producthandle+'.js', function(product) {
              if(value.variant_title != null && value.variant_title!='default title'){
              var title = value.variant_title;
              title = title.split('/');
              var varianttitle = '';
              jQuery(jQuery(product.options).toArray()).each(function(key,value){
                var name = value.name;
                name = name.split(/ +/);
                var label = name[name.length-1]; //last item of array
                //capitalize
                var firstChar = label.substring( 0, 1 ); // == "c"
                firstChar = firstChar.toUpperCase();
                tail = label.substring( 1 ); // == "olour"
                label = firstChar + tail; // label = Colour

                var temp_string='';
                if(key!=0){temp_string='<br/>'}
                varianttitle += temp_string+label+': '+title[key];
              });
              title = varianttitle;
              jQuery('#'+producthandle+'_'+variantid+'_quote').html(varianttitle);
            }
            });
      // if(value.variant_title != 'default title'){
      //   html += '<br><small id="'+producthandle+'_'+variantid+'_quote">'+title+'</small>';
      // }
      var price = value.price;
      var price = price.split('.');
      var adArray = [];
      var addJson = {id:value.variant_id,properties:{_eligiable:1,_addfreesample:0},quantity:value.quantity};
      adArray.push(addJson);
      var addJsonString = JSON.stringify(adArray);
      html += '<div class="minicart-actions">';
      html += '<div class="minicart-qty-container">';
      html += '<input value="-" class="qtyminus" field="'+value.variant_id+'" type="button">';
      html += '<input readonly type="text" name="quote-quantity" class="quote-quantity-update" data-product-price="'+value.price+'" data-product-id="'+value.id+'" data-variant-id="'+value.variant_id+'" value="'+value.quantity+'" min="0">';
      html += '<input value="+" class="qtyplus" field="'+value.variant_id+'" type="button">';
      html += '</div>';
      html += '<span class="price">'+price[0]+'</span>';
      html += '</div>';
      html += '<a class="addtocart-wishlist" href="#" data-cart-addclaims=\''+ addJsonString +'\'>Add to Cart</a>';
      html += '<a href="javascript:void(0);" class="remove-item-from-quote" data-variant-id="'+value.variant_id+'"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 413.348 413.348" width="12" xmlns:v="https://vecta.io/nano"><path d="M413.348 24.354L388.994 0l-182.32 182.32L24.354 0 0 24.354l182.32 182.32L0 388.994l24.354 24.354 182.32-182.32 182.32 182.32 24.354-24.354-182.32-182.32z"/></svg></a>';
      html += '</div>';
      html += '</div>';
      html += '</li>';
    }
  });
  html += '</ul>';
  html += '</form>';
  html += '<a href="#" id="addEverthingToCart" data-cart-addclaims="">Add Everything to Cart</a>'; 
  html = (products.length > 0) ? html : empty_html_message;
  $('#wishListWrapper').html(html);
}

$(document).on('wishlisttocart', function(e, vIds){
  $.each(vIds, function(k, v){
    remove_product(v);
  });
  setAddAllToCart();
});

function remove_product(variant_id){
  var products = get_cookie('product_list');
  var updated_products = []
  $.each( products, function( key, value ) {
    if(value.variant_id != variant_id){
      updated_products.push(value);
    }
  });
  set_cookie('product_list', updated_products);
  get_html(updated_products);
}

function update_product_quantity(product_id, variant_id, update_quantity, price){
  var updated_products = [];
  products = get_cookie('product_list');
  $.each( products, function( key, value ) {
    var remove_row = false;
    if(value.variant_id == variant_id){
      update_quantity++;
      value.quantity = update_quantity;
      value.total = price * update_quantity;
    }
    if(value.quantity != 0){
      updated_products.push(value);
    }
  });
  set_cookie('product_list', updated_products);
  if(product_id != 'trigger'){
    get_html(updated_products);
  }
}
//Can refactor update_product_quantity_new and update_product_quantity_new
function update_product_quantity_new(product_id, variant_id, update_quantity, price){
  var updated_products = [];
  products = get_cookie('product_list');
  $.each( products, function( key, value ) {
    var remove_row = false;
    if(value.variant_id == variant_id){
      value.quantity = update_quantity;
      value.total = price * update_quantity;
    }
    if(value.quantity != 0){
      updated_products.push(value);
    }
  });
  set_cookie('product_list', updated_products);
  if(get_cookie('product_list').length == 0){
    //$('#send_quote').hide();
    //$('#checkout_quote').hide();
  }
  if(product_id != 'trigger'){
    get_html(updated_products);
  }
}

function check_product_already_exist(product_id, variant_id){
  if(get_cookie('product_list') != null){
    var products = get_cookie('product_list');
  }else{
    var products = [];
  }
  var condition = false;
  var exist_product;
  $.each( products, function( key, value ) {
    if(value.variant_id == variant_id){
      condition = true;
      exist_product = value;
    }
  });
  if(condition){
    return exist_product;
  }else{
    return false;
  }
}

  $(document).off().on('click', '.add_to_wishlist', function(e){
    console.log('Added To Wishlist');
    var product = {};
    product.title = $(this).attr('data-w-product-title');
    product.image = $(this).attr('data-w-product-image');
    product.price = $(this).attr('data-w-product-price');
    product.id = $(this).attr('data-w-product-id');
    product.variant_id =  $(this).attr('data-w-variant-id');
    var trigger_variant_id = $(this).attr('data-w-variant-id');
    product.handle = $(this).attr('data-w-product-handle');
    product.variant_title = $(this).attr('data-w-variant-title');
    product.variant_sku = $(this).attr('data-w-variant-sku');
    //product.quantity = parseInt($(this).attr('data-quantity'));
    product.quantity = 1;
    var product_exit = check_product_already_exist(product.id, product.variant_id);
    console.log(product_exit);
    if(product_exit){
      var update_quantity = product_exit.quantity + product.quantity;
      var filter_price = parseInt(product.price.replace('$','').replace(',',''));
      update_product_quantity_new(product.id, product.variant_id, update_quantity, filter_price);
      //show_quote();
    }else{
      //var filter_price = parseInt(product.price.replace('$',''));
      var filter_priceupdate_product_quantity_new = parseInt(product.price.replace('$','').replace(',',''));
      product.total = filter_price * product.quantity;
      if(get_cookie('product_list') != null){
        var products = get_cookie('product_list');
      }else{
        console.log('First product in quote');
        var products = [];
      }
      products.push(product);
      set_cookie('product_list', products);
      get_html(products);
      //show_quote();
    }
    //active state quote
    jQuery(this).addClass('addedtoquote');
    jQuery('[data-w-variant-id="'+trigger_variant_id+'"]').addClass('addedtoquote');
    
    //console.log(get_cookie('product_list'));
    e.preventDefault();
    e.stopPropagation();
    setAddAllToCart();
    wishlistMiniCartOpener();
    wishlistContainerHeightCalc();
    $.magnificPopup.close();
    setTimeout(function(){
      $("body").addClass("sticky-nav-min");
    },100);
    //return false;
  });

function setAddAllToCart(){
  // Add all to cart ----------------------------------
  var addArray = [];
  $("#wishListWrapper .addtocart-wishlist").each(function(){
    var jsonString = $(this).attr('data-cart-addclaims');
    var adArray = JSON.parse(jsonString);
    addArray.push(adArray[0]);
    
  });
  addAllJsonString = JSON.stringify(addArray);
  $("#addEverthingToCart").attr('data-cart-addclaims' , addAllJsonString);
  // Add all to cart ----------------------------------
}

$(document).ready(function(){
  get_html(products);
  setAddAllToCart();
  $(document).on('click','.remove-item-from-cart',function(){
    var selector = $(this);
    var variant_id = $(this).data('variant-id');
    var data = {id:variant_id, quantity:0};
    var quantity = $('#updates_'+variant_id).val();

    var price = parseInt($(this).attr('data-price'))/100;
    var reduce_price = quantity * price;
    var sub_total = parseInt($('#sidebar-subtotal').attr('data-price'))/100;
    console.log(sub_total+'-'+reduce_price);
    var total = sub_total-reduce_price;

    var url = baseUrl + '/cart/change.js';
    $.ajax({
      type: "POST",
      async: false,
      url: url,
      data: data,
      dataType: "json",
      success: function(data) {
        $('#sidebar-subtotal').attr('data-price', total*100).attr('data-total', total*100);
        $('#sidebar-subtotal').html('$'+total);
        selector.closest( "li" ).remove();
        if($('#cart-container ul li.single-product').length == 0){
          $('#cart-container').find('form').remove();
          $('<div id="cart-empty" class="cart-empty"><h2>Your Cart</h2><p>Your cart is currently empty.</p><p>Continue browsing <a href="/collections/all">here</a>.</p></div>').insertAfter('#cart-container .nav-tab-title');
        }
      }
    });
  });

  $(document).on('click','.remove-item-from-quote',function(){
    var variant_id = $(this).data('variant-id');
    var products = get_cookie('product_list');
    var data = $.grep(products, function(e){
      return e.variant_id != variant_id;
    });
    set_cookie('product_list', data);
    $(this).closest( "li" ).remove();
    if(data.length == 0){
      $('#wishListWrapper').html(empty_html_message);
      $("#addEverthingToCart").remove();
    }
    //remove active state quote
    jQuery('[data-variant-id="'+variant_id+'"]').removeClass('addedtoquote');
    setAddAllToCart();

  });

  $(document).on('click keyup change','.quantity-selector',function(){
    $('.add_to_quote').attr('data-quantity', $(this).val());
  });

    $(document).on('keyup change','.quote-sidebar .quote-quantity-update', function(){
      if($( this ).val() != ''){
        var current_quantity = parseInt($( this ).val());
        var trigger_quantity = current_quantity - 1;
        var trigger_variant_id = $( this ).data('variant-id');
        var trigger_product_price = parseInt($( this ).data('product-price').replace('$','').replace(',',''));
        var product_id = 'trigger';
        $(this).closest('.details').find('.add-to-cart').attr('data-quantity', current_quantity);
        if($(this).val() == 0){
          $(this).closest('li').remove();
          //remove active state quote
        jQuery('[data-variant-id="'+trigger_variant_id+'"]').removeClass('addedtoquote');
        }
        if($('.quote-quantity-update').length == 0){
          $('#wishListWrapper').html(empty_html_message);
          $("#addEverthingToCart").remove();
        }
        update_product_quantity(product_id, trigger_variant_id, trigger_quantity, trigger_product_price);
      }
  });
});

// This button will increment the value
$(document).on('click','.qtyplus',function(e){
    // Stop acting like a button
    e.preventDefault();
    // Get the field name
    fieldName = $(this).attr('field');
    // Get its current value
    var currentVal = parseInt($(this).parent().find('input[data-variant-id='+fieldName+']').val());
    // If is not undefined
    if (!isNaN(currentVal)) {
      // Increment
      var new_val = currentVal + 1;
      $(this).parent().find('input[data-variant-id='+fieldName+']').val(new_val);
      $(this).parent().find('input[data-variant-id='+fieldName+']').attr('value',new_val);
      var addJsonString = $(this).parents('.minicart-actions').siblings('.addtocart-wishlist').attr('data-cart-addclaims');
      var adArray = JSON.parse(addJsonString);
      adArray[0].quantity = new_val;
      addJsonString = JSON.stringify(adArray);
      $(this).parents('.minicart-actions').siblings('.addtocart-wishlist').attr('data-cart-addclaims', addJsonString);
      setAddAllToCart();
    } else {
      // Otherwise put a 0 there
      $(this).parent().find('input[data-variant-id='+fieldName+']').val(0);
      $(this).parent().find('input[data-variant-id='+fieldName+']').attr('value',new_val);
    }
    if($( this ).siblings('.quote-quantity-update').val() != ''){
        var current_quantity = parseInt($( this ).siblings('.quote-quantity-update').val());
        var trigger_quantity = current_quantity - 1;
        var trigger_variant_id = $( this ).siblings('.quote-quantity-update').data('variant-id');
        var trigger_product_price = parseInt($( this ).siblings('.quote-quantity-update').data('product-price').replace('$','').replace(',',''));
        var product_id = 'trigger';
        $(this).closest('.details').find('.add-to-cart').attr('data-quantity', current_quantity);
        if($(this).siblings('.quote-quantity-update').val() == 0){
          $(this).closest('li').remove();
        }
        if($('.quote-quantity-update').length == 0){
          $('#wishListWrapper').html(empty_html_message);
          $("#addEverthingToCart").remove();
        }
        update_product_quantity(product_id, trigger_variant_id, trigger_quantity, trigger_product_price);
      }
});

// This button will decrement the value till 0
$(document).on('click','.qtyminus',function(e){
    // Stop acting like a button
    e.preventDefault();
    // Get the field name
    fieldName = $(this).attr('field');
    // Get its current value
    var currentVal = parseInt($(this).parent().find('input[data-variant-id='+fieldName+']').val());
    // If it isn't undefined or its greater than 0
    if (!isNaN(currentVal) && currentVal > 1) {
      // Decrement one
      var new_val = currentVal - 1;
      $(this).parent().find('input[data-variant-id='+fieldName+']').val(new_val);
      $(this).parent().find('input[data-variant-id='+fieldName+']').attr('value',new_val);
      var addJsonString = $(this).parents('.minicart-actions').siblings('.addtocart-wishlist').attr('data-cart-addclaims');
      var adArray = JSON.parse(addJsonString);
      adArray[0].quantity = new_val;
      addJsonString = JSON.stringify(adArray);
      $(this).parents('.minicart-actions').siblings('.addtocart-wishlist').attr('data-cart-addclaims', addJsonString);
      setAddAllToCart();
    } else {
      // Otherwise put a 0 there
      $(this).parent().find('input[data-variant-id='+fieldName+']').val(0);
      $(this).parent().find('input[data-variant-id='+fieldName+']').attr('value',1);
    }
    if($( this ).siblings('.quote-quantity-update').val() != ''){
        var current_quantity = parseInt($( this ).siblings('.quote-quantity-update').val());
        var trigger_quantity = current_quantity - 1;
        var trigger_variant_id = $( this ).siblings('.quote-quantity-update').data('variant-id');
        var trigger_product_price = parseInt($( this ).siblings('.quote-quantity-update').data('product-price').replace('$','').replace(',',''));
        var product_id = 'trigger';
        $(this).closest('.details').find('.add-to-cart').attr('data-quantity', current_quantity);
        if($(this).siblings('.quote-quantity-update').val() == 0){
          $(this).closest('li').remove();
        }
        if($('.quote-quantity-update').length == 0){
          $('#wishListWrapper').html(empty_html_message);
          $("#addEverthingToCart").remove();
        }
        update_product_quantity(product_id, trigger_variant_id, trigger_quantity, trigger_product_price);
      }
});