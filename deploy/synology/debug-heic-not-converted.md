# Debug Session: heic-not-converted
- **Status**: [OPEN]
- **Issue**: HEIC/HEIF 素材日志提示走兜底转换，但最终未生成输出 JPG，且日志未出现“兜底转换失败”
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-heic-not-converted.ndjson

## Reproduction Steps
1. (pending)

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `heif-convert/sips` 实际执行失败但错误未被捕获或未被记录到现有日志 | Med | Low | Pending |
| B | 兜底临时文件生成成功，但 `sharp(tmpJpeg)` 二次处理失败，错误被上层吞掉或写入了 info 文件而非日志 | High | Low | Pending |
| C | 兜底转换输出到了意外路径/权限问题导致临时文件被清理或不可读，最终输出被删除 | Med | Med | Pending |
| D | `convertToJpeg()` 成功但后续 `processMaterialFile()` 写入/重命名/manifest 逻辑导致输出被覆盖或被认为“已存在”而跳过 | Low | Med | Pending |
| E | 实际处理的文件并非该 HEIC（被扫描规则/索引过滤、重复 fp、或被标记 enrichOnly），导致看起来没生成 | Med | Med | Pending |

## Log Evidence
(pending)

## Verification Conclusion
(pending)
