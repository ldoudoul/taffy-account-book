(function(){
 if(!app.project||!app.project.file){app.open(new File('D:/素材库/记账喵-1.2.0/动画工程/taffy-六种底部固定互动.aep'));}
 if(app.project.file.name.indexOf('taffy-')!==0){alert('请打开记账喵的动画工程后运行。');return;}
 var base='D:/素材库/记账喵-1.2.0/动画工程/';
 for(var i=1;i<=app.project.numItems;i++){
  var item=app.project.item(i);
  if(item instanceof FootageItem && item.file){
   var replacement=new File(base+'素材/'+item.file.name);
   if(replacement.exists)item.replace(replacement);
  }
 }
 app.project.save(new File(base+'taffy-六种底部固定互动.aep'));
})();
