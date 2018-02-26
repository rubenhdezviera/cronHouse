var fs = require('fs');

module.exports.loadEmailTemplate = function(item) {
  var EMAIL_TEMPLATE_FILE = __dirname + '/email_template.html';
  var template = fs.readFileSync(EMAIL_TEMPLATE_FILE, "utf8");
  for (var property in item) {
    if (item.hasOwnProperty(property)) {
      if(property == "pictures") {
        var pictures_html = "";
        item.pictures.forEach(function(picture){
          pictures_html += '<tr><td style="vertical-align: top;"><a target="_blank" href="'+picture.big_img+'"><img style="margin: 0; Margin-bottom: 15px;" src="'+picture.small_img+'"/></a></td></tr>';
        });
        template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), pictures_html);

      } else if(property == "real_estate") {
        if(item.real_estate)
          template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), item.source);
        else
          template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), '¡DE PARTICULAR! - ' + item.source);

      } else if(property == "phone") {
        if(item.phone == '')
          template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), '');
        else {
          var phoneButton = '<br /><tr><td style="font-family: sans-serif; font-size: 14px; vertical-align: top; background-color: #3498db; border-radius: 5px; text-align: center;"><a href="tel:'+item.phone+'" target="_blank" style="display: inline-block; color: #ffffff; background-color: #3498db; border: solid 1px #3498db; border-radius: 5px; box-sizing: border-box; cursor: pointer; text-decoration: none; font-size: 14px; font-weight: bold; margin: 0; padding: 12px 25px; text-transform: capitalize; border-color: #3498db;">LLAMAR</a></td></tr>'
          template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), phoneButton);
        }

      } else 
        template = template.replace(new RegExp('\{\{' + property + '\}\}', 'g'), item[property]);
    }
  }
  return template;
};