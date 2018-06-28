<?= $this->asset->css('plugins/Indicateurs/css/indicateurs.css') ?>

<?php
include "main.html";
?>  

<script>
var params = <?= json_encode($params, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?>;
</script>

<?= $this->asset->js('plugins/Indicateurs/js/highcharts.js') ?>
<?= $this->asset->js('plugins/Indicateurs/js/vue.js') ?>
<?= $this->asset->js('plugins/Indicateurs/js/indicateurs.js') ?>
