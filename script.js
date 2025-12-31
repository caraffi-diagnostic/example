/* script.js — pure black + brandbook gradients + category line + curved label underneath (fixed) */

/* global d3 */
(function () {
    const errEl = document.getElementById("err");
  function showErr(msg) {
    if (!errEl) return;
    errEl.style.display = "block";
    errEl.style.background = "rgba(255,0,0,0.15)";
    errEl.style.border = "1px solid rgba(255,0,0,0.35)";
    errEl.style.padding = "10px 12px";
    errEl.style.margin = "12px";
    errEl.style.borderRadius = "10px";
    errEl.style.fontFamily = "system-ui, sans-serif";
    errEl.textContent = msg;
  }

  // If D3 didn't load, tell us clearly
  if (!window.d3) {
    showErr("ERROR: D3 did not load. The CDN may be blocked. Try another network, disable blockers, or host d3 locally.");
    return;
  }

  console.log("script.js loaded, d3 version:", window.d3.version);

  // Brandbook gradient pairs (secondary -> primary) — exact hexes from your screenshot
  const PALETTE = {
    cost:       { secondary: "#5599e9", primary: "#00ddff" }, // blue
    operating:  { secondary: "#b0ff00", primary: "#00f88f" }, // green
    experience: { secondary: "#ffb500", primary: "#ffdb00" }, // yellow
    data:       { secondary: "#ff4d3f", primary: "#ff6600" }  // orange
  };

  const quadrants = [
    {
      name: "Operating Model",
      grad: PALETTE.operating,
      dims: [
        { label: "TA Strategy", score: 2.5 },
        { label: "Team Capability", score: 3.0 },
        { label: "Hiring Manager Capability", score: 1.0 },
        { label: "Investment", score: 4.2 },
        { label: "Quality of Hire", score: 2.2 },
        { label: "Workforce Planning", score: 3.8 },
        { label: "Agility", score: 2.9 },
        { label: "Sourcing", score: 4.6 },
      ]
    },
    {
      name: "Brand & Experience",
      grad: PALETTE.experience,
      dims: [
        { label: "EVP", score: 3.2 },
        { label: "Attraction", score: 2.4 },
        { label: "Employer Brand", score: 4.8 },
        { label: "Candidate Experience", score: 1.9 },
        { label: "DE&I Plan", score: 2.7 },
        { label: "Internal Experience", score: 3.6 },
      ]
    },
    {
      name: "Data",
      grad: PALETTE.data,
      dims: [
        { label: "Data", score: 4.1 },
        { label: "Market Insights", score: 2.0 },
        { label: "Processes", score: 3.3 },
        { label: "Compliance", score: 1.2 },
        { label: "Selection", score: 4.7 },
      ]
    },
    {
      name: "Cost",
      grad: PALETTE.cost,
      dims: [
        { label: "Cost Transparency", score: 3.5 },
        { label: "Cost Efficiency", score: 2.0 },
        { label: "Governance", score: 4.0 },
        { label: "ROI", score: 1.5 },
      ]
    }
  ];

  // ---------- Validation ----------
  const expected = { "Cost": 4, "Operating Model": 8, "Brand & Experience": 6, "Data": 5 };
  const errEl = document.getElementById("err");

  const mismatch = quadrants
    .map(q => ({ name: q.name, got: q.dims.length, want: expected[q.name] }))
    .filter(x => x.got !== x.want);

  if (mismatch.length) {
    if (errEl) {
      errEl.style.display = "block";
      errEl.textContent =
        "SEGMENT COUNT MISMATCH: " +
        mismatch.map(m => `${m.name} got ${m.got} want ${m.want}`).join(" | ");
    }
    throw new Error("Segment count mismatch");
  } else if (errEl) {
    errEl.style.display = "none";
  }

  render(quadrants);

  function render(quadrants) {
    const svg = d3.select("#chart");
    svg.selectAll("*").remove(); // hard reset

    const W = 800, H = 800;
    const cx = W / 2, cy = H / 2;

    const innerR = 92;     // centre reference
    const outerR = 250;    // outer boundary for wedges
    const maxScore = 5;

    // d3.arc convention: angle=0 at 12 o'clock, clockwise
    function polarXY(angle, r) {
      return [Math.sin(angle) * r, -Math.cos(angle) * r];
    }

    function normalizeDeg(deg) {
      return ((deg + 180) % 360) - 180;
    }

    function safeId(s) {
      return s.replace(/[^a-z0-9]/gi, "");
    }

    // Tooltip
    const tt = document.getElementById("tt");
    const showTT = (event, html) => {
      if (!tt) return;
      tt.innerHTML = html;
      tt.style.left = event.clientX + "px";
      tt.style.top = event.clientY + "px";
      tt.style.opacity = 1;
    };
    const moveTT = (event) => {
      if (!tt) return;
      tt.style.left = event.clientX + "px";
      tt.style.top = event.clientY + "px";
    };
    const hideTT = () => { if (tt) tt.style.opacity = 0; };

    // Group centred
    const root = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    // Overall score
    const allDims = quadrants.flatMap(q => q.dims);
    const overall = d3.mean(allDims, d => d.score);

    // ---- Category line geometry ----
    const catLineR = innerR + 24;      // line radius
    const CAT_LABEL_GAP = 14;          // constant gap between line and label
    const catTextR = catLineR - CAT_LABEL_GAP;

    // Wedges should start outside the category line + text:
    const wedgeInnerR = innerR + 34;

    // FIX for low-score glitches: scale starts at wedgeInnerR
    const wedgeScale = d3.scaleLinear()
      .domain([0, maxScore])
      .range([wedgeInnerR, outerR]);

    // ---- defs: gradients + text paths ----
    const defs = svg.append("defs");

    function makeLinearGrad(id, from, to) {
      const g = defs.append("linearGradient")
        .attr("id", id)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", 0).attr("y1", -outerR)
        .attr("x2", 0).attr("y2", outerR);

      g.append("stop").attr("offset", "0%").attr("stop-color", from);
      g.append("stop").attr("offset", "100%").attr("stop-color", to);
    }

    quadrants.forEach((q, i) => {
      makeLinearGrad(`grad-q${i}`, q.grad.secondary, q.grad.primary);
    });

        // Watermark
    svg.append("text")
      .attr("class", "watermark")
      .attr("x", 24)
      .attr("y", 34)
      .text("CATEGORY LINE + LABEL UNDER");

    // ---- Category line arcs + curved labels underneath ----
    const ringData = quadrants.map((q, i) => ({
      name: q.name,
      a0: i * (Math.PI / 2),
      a1: (i + 1) * (Math.PI / 2),
      aMid: (i + 0.5) * (Math.PI / 2),
      idx: i
    }));

    // Helper for arc path string
    // sweep = 1 clockwise, 0 counter-clockwise
    function arcPathD(r, a0, a1, sweep) {
      const [x0, y0] = polarXY(a0, r);
      const [x1, y1] = polarXY(a1, r);
      const da = Math.abs(a1 - a0);
      const largeArc = da > Math.PI ? 1 : 0;
      return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} ${sweep} ${x1} ${y1}`;
    }

    // 1) Bold colour line (stroke only)
    const epsLine = 0.03;
    root.append("g")
      .selectAll("path")
      .data(ringData)
      .join("path")
      .attr("d", d => arcPathD(catLineR, d.a0 + epsLine, d.a1 - epsLine, 1))
      .attr("fill", "none")
      .attr("stroke", d => `url(#grad-q${d.idx})`)
      .attr("stroke-width", 6)
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.95);

    // 2) Curved text underneath (on a separate radius)
    const epsText = 0.04;

    defs.selectAll("path.catTextPath")
      .data(ringData)
      .join("path")
      .attr("class", "catTextPath")
      .attr("id", d => `catText-${safeId(d.name)}`)
      .attr("d", d => {
        const deg = d.aMid * 180 / Math.PI;
        const isBottomHalf = (deg > 90 && deg < 270);

        // Top half clockwise; bottom half counter-clockwise so it reads upright
        return !isBottomHalf
          ? arcPathD(catTextR, d.a0 + epsText, d.a1 - epsText, 1)
          : arcPathD(catTextR, d.a1 - epsText, d.a0 + epsText, 0);
      });

    // Single label layer (no dy drift)
    root.append("g")
      .selectAll("text")
      .data(ringData)
      .join("text")
      .attr("class", "quadTitle")
      .attr("dominant-baseline", "middle")
      .append("textPath")
      .attr("href", d => `#catText-${safeId(d.name)}`)
      .attr("startOffset", "50%")
      .attr("text-anchor", "middle")
      .text(d => d.name);

    // ---- Centre circle + overall score (on top) ----
    root.append("circle")
      .attr("r", innerR - 10)
      .attr("fill", "rgba(233,238,245,0.05)")
      .attr("stroke", "rgba(233,238,245,0.10)");

    root.append("text")
      .attr("class", "scoreText")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("y", -8)
      .text(overall.toFixed(1));

    root.append("text")
      .attr("class", "scoreSub")
      .attr("text-anchor", "middle")
      .attr("y", 40)
      .text("OVERALL");

    // Outer boundary ring
    root.append("circle")
      .attr("r", outerR)
      .attr("fill", "none")
      .attr("stroke", "rgba(233,238,245,0.14)");

    // ---- Wedges + labels ----
    const wedgeArc = d3.arc().cornerRadius(5);

    quadrants.forEach((q, qi) => {
      const qStart = qi * (Math.PI / 2);
      const qEnd = (qi + 1) * (Math.PI / 2);
      const n = q.dims.length;
      const step = (qEnd - qStart) / n;

      const wedgeData = q.dims.map((d, i) => {
        const a0 = qStart + i * step;
        const a1 = qStart + (i + 1) * step;
        return { ...d, quadrant: q.name, a0, a1, aMid: (a0 + a1) / 2 };
      });

      // Wedges (gradient fill per quadrant)
      root.append("g")
        .selectAll("path")
        .data(wedgeData, d => `${d.quadrant}-${d.label}`)
        .join("path")
        .attr("class", "seg")
        .attr("d", d => wedgeArc({
          innerRadius: wedgeInnerR,
          outerRadius: wedgeScale(d.score),
          startAngle: d.a0 + 0.01,
          endAngle: d.a1 - 0.01
        }))
        .attr("fill", `url(#grad-q${qi})`)
        .attr("fill-opacity", 0.92)
        .on("mouseenter", (event, d) =>
          showTT(event, `<b>${d.quadrant}</b><br>${d.label}: <b>${d.score.toFixed(1)}</b> / 5`)
        )
        .on("mousemove", moveTT)
        .on("mouseleave", hideTT);

      // Score numbers around the ring
      const scoreR = outerR + 10;
      root.append("g")
        .selectAll("text")
        .data(wedgeData, d => `${d.quadrant}-${d.label}-score`)
        .join("text")
        .attr("class", "value")
        .attr("text-anchor", "middle")
        .attr("x", d => polarXY(d.aMid, scoreR)[0])
        .attr("y", d => polarXY(d.aMid, scoreR)[1])
        .text(d => d.score.toFixed(1));

      // Dimension labels (radial, never upside down)
      const labelBaseR = outerR + 30;
      const labelGap = 6;

      const labelNodes = root.append("g")
        .selectAll("g")
        .data(wedgeData, d => `${d.quadrant}-${d.label}-dim`)
        .join("g")
        .attr("transform", d => {
          const [x, y] = polarXY(d.aMid, labelBaseR);
          const deg = d.aMid * 180 / Math.PI;

          let rot = normalizeDeg(deg - 90);
          const flipped = (rot > 90 || rot < -90);
          if (flipped) rot += 180;

          return `translate(${x},${y}) rotate(${rot})`;
        });

      labelNodes.append("text")
        .attr("class", "dimLabel")
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", d => {
          const deg = d.aMid * 180 / Math.PI;
          let rot = normalizeDeg(deg - 90);
          const flipped = (rot > 90 || rot < -90);
          return flipped ? "end" : "start";
        })
        .attr("x", d => {
          const deg = d.aMid * 180 / Math.PI;
          let rot = normalizeDeg(deg - 90);
          const flipped = (rot > 90 || rot < -90);
          return flipped ? -labelGap : labelGap;
        })
        .attr("y", 0)
        .text(d => d.label);
    });
  }
})();
