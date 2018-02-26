module.exports.scrapFotocasa = function($, realEstates) {
    var FOTOCASA_BASE_URL = 'https://www.fotocasa.es';
    var items=[];
    realEstates.forEach(function (e, i) {
        var item = { source:'Fotocasa', real_estate: true };
        item['link'] = FOTOCASA_BASE_URL + e.detail["es-ES"];
        item['id'] = e.id;
        item['title'] = e.location;
        item['price'] = e.price;
        item['price'] = item['price'].substr(0, item['price'].search(' €')).replace('.', '');
        item['price'] = item['price'] != '' ? parseInt(item['price']) : 0;
        item['description'] = e.description;
        item['num_rooms'] = 0;
        item['m2'] = 0;
        e.features.forEach(function(feature){
          if(feature.key == 'rooms')
            item['num_rooms'] = feature.value;
          else if(feature.key == 'surface')
            item['m2'] = feature.value;
        });
        item['phone'] = e.phone;
        var pictures = [];
        e.multimedia.forEach(function(media) {
          if(media.type == 'image')
            pictures.push({
              small_img: media.src,
              big_img: media.src.substr(0, media.src.indexOf(".jpg") + 4)
            });
        });
        item['pictures'] = pictures;

        item['date_added'] = new Date().getTime();
        items.push(item);
    });
    
    next_url_node = $('a.sui-LinkBasic.sui-PaginationBasic-link').filter(function(){
      return $(this).text().trim() == '>';
    });
    var next_url = $(next_url_node).attr('href') != undefined ? FOTOCASA_BASE_URL + $(next_url_node).attr('href') : '';

    return {
      new_items: items,
      next_url: next_url
    };
};

module.exports.scrapIdealista = function($) {
    var IDEALISTA_BASE_URL = 'https://www.idealista.com';
    var items=[];
    $('article').each(function (i) {
        var item = { source:'Idealista' };
        item['id'] = $(this).children('.item').attr('data-adid');
        item['title'] = $(this).find('.item-link').text();
        item['link'] = IDEALISTA_BASE_URL + $(this).find('.item-link').attr('href');
        item['price'] = $(this).find('.item-price').text();
        item['price'] = item['price'].substr(0, item['price'].search('€/mes')).replace('.', '');
        item['price'] = item['price'] != '' ? parseInt(item['price']) : 0;
        item['description'] = $(this).find('.item-description').text();
        item['num_rooms'] = $(this).find('.item-detail').filter(function () {
          return $(this).html().search('<small>hab.</small>') > -1;
        }).text().substr(0, 1);
        item['num_rooms'] = item['num_rooms'] != '' ? parseInt(item['num_rooms']) : 0;
        item['m2'] = $(this).find('.item-detail').filter(function () {
          return $(this).html().search('<small>m&#xB2;</small>') > -1;
        }).text();
        item['m2'] = item['m2'] != '' ? parseInt(item['m2'].substr(0, item['m2'].indexOf(' '))) : 0;
  
        $(this).find('.item-toolbar-contact').each(function(index,e) {
          var phoneData = $(e).find('.item-clickable-phone');
          item['phone'] = $(phoneData).attr('href') == undefined ? '' : $(phoneData).attr('href').replace('tel:', '').trim();
          item['real_estate'] = $(phoneData).attr('data-xiti-page') == undefined ? true : $(phoneData).attr('data-xiti-page').indexOf('particular') == -1;
        });
  
        var pictures = [];
         $(this).find('img').each(function(i,e) {
          var possible_img = $(e).attr('data-ondemand-img');
          if(possible_img.indexOf('WEB_LISTING') > -1) {
            pictures.push({
              big_img: possible_img,
              small_img: possible_img.replace('WEB_LISTING', 'WEB_DETAIL-L-L')
            });
          }
        });
        item['pictures'] = pictures;

        item['date_added'] = new Date().getTime();
        items.push(item);
    });

    var next_url = $('.icon-arrow-right-after').attr('href');
    next_url = next_url != undefined ? IDEALISTA_BASE_URL + next_url : '';

    return {
      new_items: items,
      next_url: next_url
    };
};