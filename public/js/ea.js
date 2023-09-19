
    document.addEventListener('click', function(event) {
      const checkbox = document.getElementById('tooltipCheckbox');
      if (!event.target.matches('.tooltip, .tooltip *')) {
        checkbox.checked = false;
      }
    });
